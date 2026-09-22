// Instance-wide preference checks, restricted to the disposable Trilium server.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { connect, request, testRoot, baseUrl } from './test-client.mjs';

const { browser, context, page } = await connect();
const notes = JSON.parse(await readFile(new URL('spike-notes.json', testRoot), 'utf8'));
const label = 'willowUiHidden', passed = [];
const pass = text => { passed.push(text); console.log(text); };
const pane = (p, id) => p.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
const attributes = () => request(page, 'GET', 'notes/root/attributes');
const preference = async () => (await attributes()).find(a => a.noteId === 'root' && a.type === 'label' && a.name === label);
const original = await preference();
const set = value => request(page, 'PUT', 'notes/root/set-attribute', { type: 'label', name: label, value, isInheritable: false });
async function remove() {
  const attr = await preference();
  if (attr) await request(page, 'DELETE', `notes/root/attributes/${attr.attributeId}`);
}
async function single(p, id) {
  await p.waitForFunction(() => globalThis.glob?.appContext?.tabManager?.getActiveContext());
  await p.evaluate(async id => {
    const m = glob.appContext.tabManager, main = m.getActiveMainContext().ntxId;
    for (const c of [...m.noteContexts]) if (c.ntxId !== main) await m.removeNoteContext(c.ntxId);
    await m.activateNoteContext(main); await m.getActiveContext().setNote(id);
  }, id);
  if (id === notes.folder) await p.waitForFunction(() => !document.querySelector('.willow-spike'));
  else await pane(p, id).locator('[data-ready=true]').waitFor();
}
async function bars(p, id, hidden) {
  for (const selector of ['.willow-toolbar', '.willow-statusbar'])
    await pane(p, id).locator(selector).waitFor({ state: hidden ? 'hidden' : 'visible' });
}
async function toggle(p, id, hide) {
  // Let the canvas resize settle before opening a menu, which closes on resize.
  await p.waitForTimeout(150);
  const target = pane(p, id);
  if (hide) await target.locator('[data-action=more]').click();
  else { await target.focus(); await p.keyboard.press('Shift+F10'); }
  await target.getByRole('menuitem', { name: hide ? 'Hide UI' : 'Show UI', exact: true }).click();
  await bars(p, id, hide);
}
async function create(parent, title, type, mime, content) {
  return (await request(page, 'POST', `notes/${parent}/children?target=into`, { title, type, mime, content, isProtected: false })).note.noteId;
}
let installation, other;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await remove();
  await page.setViewportSize({ width: 2300, height: 960 });
  await single(page, notes.A);
  const raw = (await request(page, 'GET', `notes/${notes.A}/blob`)).content;
  installation = await create(notes.folder, 'Visibility test installation', 'text', 'text/html', '<p>Disposable fixture</p>');
  const code = await create(installation, 'Shared editor', 'code', 'text/jsx', await readFile(new URL('../dist/willow-spike.js', import.meta.url), 'utf8'));
  const clone = await create(installation, 'Visibility test map', 'render', 'application/json', raw);
  await request(page, 'PUT', `notes/${clone}/attributes`, [
    { type: 'label', name: 'willowMindMap', value: '', isInheritable: false },
    { type: 'relation', name: 'renderNote', value: code, isInheritable: false },
  ]);
  await page.evaluate(id => glob.appContext.triggerCommand('openNewNoteSplit', {
    ntxId: glob.appContext.tabManager.getActiveContext().ntxId, notePath: id,
  }), clone);
  await pane(page, clone).locator('[data-ready=true]').waitFor();
  await toggle(page, notes.A, true); await bars(page, clone, true);
  const attr = await preference();
  assert.equal(attr.value, 'true'); assert.equal(!!attr.isInheritable, false);
  pass('Different maps and separate Willow installations share one non-inheritable root label');

  other = await context.newPage(); other.on('pageerror', error => errors.push(error.message));
  await other.goto(`${baseUrl}/#root/${notes.folder}/${notes.B}`);
  await single(other, notes.B);
  await other.evaluate(() => globalThis[Symbol.for('trilium-willow.ui-visibility')].refresh());
  await bars(other, notes.B, true);
  await toggle(other, notes.B, false);
  await bars(page, notes.A, false); await bars(page, clone, false);
  // A remote visibility update must not interrupt a native title field.
  const title = pane(page, clone).locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," note-split ")]').locator('input.note-title:visible');
  await title.evaluate(e => e.focus());
  await toggle(other, notes.B, true);
  await bars(page, notes.A, true); await bars(page, clone, true);
  assert.equal(await title.evaluate(e => e === document.activeElement), true);
  await page.reload(); await single(page, notes.A);
  await page.evaluate(() => globalThis[Symbol.for('trilium-willow.ui-visibility')].refresh());
  await bars(page, notes.A, true);
  pass('Visibility survives reload and reaches other windows without stealing native title focus');

  await single(page, notes.folder); // No Willow panes: no attribute-event subscriber.
  await toggle(other, notes.B, false);
  await single(page, notes.A); await bars(page, notes.A, false);
  pass('Reopening a map refreshes changes received while all Willow panes were closed');

  const route = '**/api/notes/root/set-attribute';
  await page.route(route, r => r.fulfill({ status: 503, body: 'Injected test failure' }));
  await pane(page, notes.A).locator('[data-action=more]').click();
  await pane(page, notes.A).getByRole('menuitem', { name: 'Hide UI', exact: true }).click();
  await pane(page, notes.A).getByRole('alert').getByText(/Could not save the shared UI visibility preference/).waitFor();
  await bars(page, notes.A, false); await bars(other, notes.B, false);
  assert.equal((await preference()).value, 'false');
  await page.unroute(route);
  await toggle(page, notes.A, true); await bars(other, notes.B, true);
  await pane(page, notes.A).getByText(/Could not save the shared UI visibility preference/).waitFor({ state: 'hidden' });
  pass('Failed writes leave every pane unchanged, display an error and allow retry');

  await remove(); await bars(page, notes.A, false); await bars(other, notes.B, false);
  await toggle(page, notes.A, true); await bars(other, notes.B, true);
  await set('invalid'); await bars(page, notes.A, false); await bars(other, notes.B, false);
  assert.equal((await request(page, 'GET', `notes/${notes.A}/blob`)).content, raw);
  assert.deepEqual(errors, []);
  pass('Deleted or invalid preferences restore visible bars; map bytes remain unchanged');
} finally {
  await page.unroute('**/api/notes/root/set-attribute');
  if (original) await set(original.value); else await remove();
  await other?.close();
  if (installation) {
    await single(page, notes.A);
    await request(page, 'DELETE', `notes/${installation}?taskId=willow-visibility-cleanup&last=true`);
  }
  const dir = new URL('evidence/ui-visibility/', testRoot); await mkdir(dir, { recursive: true });
  await writeFile(new URL('report.json', dir), JSON.stringify({ testedAt: new Date().toISOString(), bundleSha256: notes.bundleSha256, passed, errors }, null, 2) + '\n');
  await browser.close();
}
