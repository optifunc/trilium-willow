// Requires the isolated server/browser, or --desktop with the isolated CDP 39223 app.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { connect, testRoot } from './test-client.mjs';

const desktop = process.argv.includes('--desktop');
const notes = JSON.parse(await readFile(new URL('spike-notes.json', testRoot), 'utf8'));
const bundle = await readFile(new URL('../dist/willow-spike.js', import.meta.url), 'utf8');
const browser = desktop ? await chromium.connectOverCDP(process.env.WILLOW_DESKTOP_CDP ?? 'http://127.0.0.1:39223') : (await connect()).browser;
const page = browser.contexts()[0].pages().find(p => p.url().startsWith(desktop ? 'trilium-app:' : notes.baseUrl));
const report = { testedAt: new Date().toISOString(), desktop, bundleSha256: createHash('sha256').update(bundle).digest('hex'), passed: [] };
const pass = message => { report.passed.push(message); console.log(message); };
async function api(method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    if (!['http://127.0.0.1:37841', 'trilium-app://app'].includes(location.origin)) throw new Error('Not the isolated fixture');
    const r = await fetch(`/api/${path}`, { method, headers: { ...await glob.getHeaders(), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!r.ok) throw new Error(await r.text());
    return r.status === 204 ? undefined : r.json();
  }, { method, path, body });
}
const state = () => page.evaluate(id => {
  const v = [...globalThis[Symbol.for('trilium-willow.spike')].active.values()].find(v => v.noteId === id && v.host.offsetWidth);
  const view = v.editor.getViewport(), map = v.host.querySelector('.mindmap');
  return { view, center: { x: (map.clientWidth / 2 - view.x) / view.zoom, y: (map.clientHeight / 2 - view.y) / view.zoom },
    app: globalThis.electronApi?.window.getZoomFactor() ?? devicePixelRatio, document: v.editor.getDocument() };
}, notes.A);
async function prepare(zoom = 1) {
  await page.evaluate(({ id, zoom }) => {
    const v = [...globalThis[Symbol.for('trilium-willow.spike')].active.values()].find(v => v.noteId === id && v.host.offsetWidth);
    v.editor.setZoom(zoom); v.editor.focus();
  }, { id: notes.A, zoom });
}
async function settle() { await page.waitForTimeout(200); } // Host IPC and wheel delivery are asynchronous.
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, `${actual} != ${expected}`);
try {
  await page.waitForFunction(() => globalThis.glob?.appContext?.tabManager?.getActiveContext());
  if (desktop) {
    const actions = await api('GET', 'keyboard-actions');
    for (const name of ['zoomIn', 'zoomOut', 'zoomReset']) assert.ok(actions.find(a => a.actionName === name)?.effectiveShortcuts?.length,
      `${name} is unbound: a server-seeded database must restore stock desktop zoom shortcuts before this test`);
  }
  await api('PUT', `notes/${notes.bundle}/data`, { content: bundle });
  await page.reload();
  await page.waitForFunction(() => globalThis.glob?.appContext?.tabManager?.getActiveContext());
  await page.evaluate(id => glob.appContext.tabManager.getActiveContext().setNote(id), notes.A);
  const pane = page.locator(`.willow-spike[data-note-id="${notes.A}"]:visible`);
  const map = pane.locator('.mindmap'); await map.waitFor();
  report.environment = await page.evaluate(() => ({ version: glob.triliumVersion, platform: navigator.platform, userAgent: navigator.userAgent, electron: glob.isElectron }));
  const primary = report.environment.platform.includes('Mac') ? 'Meta' : 'Control';
  if (desktop) { await page.evaluate(() => electronApi.window.setZoomFactor(1.2)); await settle(); }
  const initial = await state();
  const source = (await api('GET', `notes/${notes.A}/blob`)).content;
  for (const [key, start, expected] of [['=', 1, 1.2], ['Shift+=', 1, 1.2], ['NumpadAdd', 1, 1.2], ['-', 1, 1 / 1.2], ['NumpadSubtract', 1, 1 / 1.2], ['0', 2, 1.43], ['0', 1.43, 1.43], ['=', 5.72, 5.72], ['-', .3575, .3575]]) {
    await prepare(start); await page.keyboard.press(`${primary}+${key}`); await settle();
    const actual = await state(); close(actual.view.zoom, expected); close(actual.app, initial.app);
  }
  pass('Keyboard zoom, numpad, reset and clamp no-ops preserve app zoom');
  const fitted = await page.evaluate(id => {
    const e = [...globalThis[Symbol.for('trilium-willow.spike')].active.values()].find(v => v.noteId === id && v.host.offsetWidth).editor;
    e.fit(); return e.getViewport();
  }, notes.A);
  await prepare(.25); await page.keyboard.press(`${primary}+Shift+Digit0`); await settle();
  assert.deepEqual((await state()).view, fitted); close((await state()).app, initial.app);
  pass('Shift+0 fits only the map');
  await prepare(); await map.hover({ position: { x: 30, y: 30 } });
  const beforeWheel = await state();
  await page.keyboard.down(primary); await page.mouse.wheel(0, -100); await page.keyboard.up(primary); await settle();
  // One displayed percentage point, independent of delta magnitude or host zoom.
  close((await state()).view.zoom, beforeWheel.view.zoom + .0143); close((await state()).app, initial.app);
  await page.keyboard.down(primary); await page.mouse.wheel(0, 100); await page.keyboard.up(primary); await settle();
  close((await state()).view.zoom, 1); close((await state()).app, initial.app);
  for (const axis of ['y', 'x']) {
    const before = await state(); if (axis === 'x') await page.keyboard.down('Shift');
    await page.mouse.wheel(0, 40); if (axis === 'x') await page.keyboard.up('Shift'); await settle();
    assert.ok((await state()).view[axis] < before.view[axis]);
    close((await state()).view[axis === 'x' ? 'y' : 'x'], before.view[axis === 'x' ? 'y' : 'x']);
    close((await state()).app, initial.app);
  }
  assert.deepEqual((await state()).document, initial.document);
  assert.equal((await api('GET', `notes/${notes.A}/blob`)).content, source);
  pass('Wheel zoom in/out and vertical/horizontal pan preserve app zoom and saved map content');
  const remembered = await state();
  await page.waitForFunction(({ id, remembered }) => {
    const saved = JSON.parse(localStorage.getItem(`trilium-willow:view:v1:${id}`) || 'null');
    return saved && Math.abs(saved.zoom - remembered.view.zoom) < .00001
      && Math.abs(saved.centerX - remembered.center.x) < .00001 && Math.abs(saved.centerY - remembered.center.y) < .00001;
  }, { id: notes.A, remembered });
  await page.reload(); await map.waitFor(); await settle();
  const restored = await state();
  // Desktop app zoom is deliberately not saved by this test's direct setup call;
  // view persistence stores the world centre independently of viewport dimensions.
  close(restored.view.zoom, remembered.view.zoom);
  close(restored.center.x, remembered.center.x); close(restored.center.y, remembered.center.y);
  pass('Map zoom survives renderer reload');
  if (desktop) {
    const title = page.locator('.note-title:visible').first();
    await title.focus(); const outside = await state();
    await page.keyboard.press(`${primary}+=`); await settle();
    close((await state()).app, Math.round((outside.app + .1) * 10) / 10); close((await state()).view.zoom, outside.view.zoom);
    await page.keyboard.press(`${primary}+0`); await settle(); close((await state()).app, 1);
    await title.hover(); await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control'); await settle();
    close((await state()).app, 1.1); close((await state()).view.zoom, outside.view.zoom);
    await title.focus(); await page.keyboard.press(`${primary}+0`); await settle();
    pass('Native title focus/hover retains Trilium keyboard and Ctrl+wheel zoom');
  }
  await prepare();
  const evidence = new URL('evidence/zoom/', testRoot); await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL(`${desktop ? 'desktop' : 'browser'}-after.png`, evidence)) });
  await writeFile(new URL(`${desktop ? 'desktop' : 'browser'}-after.json`, evidence), JSON.stringify(report, null, 2) + '\n');
} finally { await browser.close(); }
