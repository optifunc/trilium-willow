import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connect, request, testRoot, baseUrl } from './test-client.mjs';

const bundle = await readFile(new URL('../dist/willow-spike.js', import.meta.url), 'utf8');
const { browser, page } = await connect();
const file = new URL('spike-notes.json', testRoot);
let notes;
try { notes = JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }

try {
  async function create(parentNoteId, title, type, mime, content) {
    const result = await request(page, 'POST', `notes/${parentNoteId}/children?target=into`, {
      title, type, mime, content, isProtected: false,
    });
    return result.note.noteId;
  }
  if (!notes) {
    notes = { baseUrl };
    notes.folder = await create('root', 'Willow integration spike', 'text', 'text/html',
      '<p>Disposable integration fixtures. Map A and Map B use the same shared editor note.</p>');
    await writeFile(file, JSON.stringify(notes, null, 2));
  }
  if (notes.baseUrl !== baseUrl) throw new Error('Spike IDs belong to another server.');
  if (!notes.bundle) notes.bundle = await create(notes.folder, 'Willow shared editor', 'code', 'text/jsx', bundle);
  else await request(page, 'PUT', `notes/${notes.bundle}/data`, { content: bundle });
  await writeFile(file, JSON.stringify(notes, null, 2));
  if (!notes.launcher) {
    notes.launcher = await create(notes.folder, 'Create a Willow mind map', 'render', 'application/json', '{}');
    await writeFile(file, JSON.stringify(notes, null, 2));
  }
  await request(page, 'PUT', `notes/${notes.launcher}/set-attribute`, { type: 'relation', name: 'renderNote', value: notes.bundle });
  await request(page, 'PUT', `notes/${notes.launcher}/set-attribute`, { type: 'label', name: 'willowLauncher', value: '' });
  for (const name of ['A', 'B']) {
    if (!notes[name]) notes[name] = await create(notes.folder, `Willow Map ${name}`, 'render', 'application/json', JSON.stringify({
      format: 'trilium-willow-mindmap', version: 1, document: { root: { id: `root-${name}`, text: `Map ${name}`, children: [
        { id: `left-${name}`, text: 'Ideas', side: 'left', children: [] },
        { id: `right-${name}`, text: 'Next steps', side: 'right', checked: false, children: [] },
      ] } },
    }));
    await request(page, 'PUT', `notes/${notes[name]}/set-attribute`, { type: 'relation', name: 'renderNote', value: notes.bundle });
    await request(page, 'PUT', `notes/${notes[name]}/set-attribute`, { type: 'label', name: 'willowMindMap', value: '' });
    await writeFile(file, JSON.stringify(notes, null, 2));
  }
  notes.bundleSha256 = createHash('sha256').update(bundle).digest('hex');
  notes.deployedAt = new Date().toISOString();
  await writeFile(file, JSON.stringify(notes, null, 2) + '\n');
  await page.goto(`${baseUrl}/#root/${notes.folder}/${notes.A}`);
  await page.reload();
  console.log(JSON.stringify(notes, null, 2));
} finally { await browser.close(); }
