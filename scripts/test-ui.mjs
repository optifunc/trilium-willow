// Exercise the same native menus, title editor and header badge on both clients.
export function nativePane(pane) {
  return pane.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " note-split ")][1]');
}

export async function waitSaved(pane) {
  await nativePane(pane).locator('.save-status-badge.saved:visible').waitFor();
}

export async function fit(page, pane) {
  await pane.locator('.mindmap').focus();
  await page.keyboard.press('Meta+Shift+Digit0');
}

export async function measureSwitch(page, title, id) {
  const before = await page.evaluate(id => {
    const d = globalThis[Symbol.for('trilium-willow.spike')];
    globalThis.willowSwitchFrames = [];
    globalThis.willowSwitchRecording = true;
    const frame = () => {
      if (!globalThis.willowSwitchRecording) return;
      const host = document.querySelector(`.willow-spike[data-note-id="${id}"] .willow-spike-host[data-ready="true"]`);
      if (host?.clientWidth) {
        const root = host.querySelector('.mindmap-root-node').getBoundingClientRect();
        globalThis.willowSwitchFrames.push({mounted:d.mounted,x:root.x,y:root.y,width:root.width});
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return d.mounted;
  },id);
  await page.locator('.fancytree-title').getByText(title,{exact:true}).click();
  await page.locator(`.willow-spike[data-note-id="${id}"] .willow-spike-host[data-ready="true"]`).waitFor();
  await page.waitForTimeout(300);
  return page.evaluate(before => {
    globalThis.willowSwitchRecording = false;
    return {mounts:globalThis[Symbol.for('trilium-willow.spike')].mounted-before,frames:globalThis.willowSwitchFrames};
  },before);
}

export async function createFromMenu(page, referenceTitle, placement, title) {
  await page.locator('.fancytree-title').getByText(referenceTitle, {exact:true}).click({button:'right'});
  const menu = page.locator('#context-menu-container');
  await menu.getByText(placement === 'after' ? 'Insert note after' : 'Insert child note').hover();
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/children'));
  await menu.getByText('Willow Mind Map').filter({visible:true}).click();
  const result = await (await response).json();
  const id = result.note.noteId;
  const pane = page.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
  await pane.locator('.willow-spike-host[data-ready="true"] .mindmap').waitFor();
  const input = nativePane(pane).locator('input.note-title:visible');
  await input.click(); await input.press('Meta+A');
  await page.keyboard.type(title, {delay:70});
  if (await input.inputValue() !== title || await pane.locator('.mindmap textarea').count())
    throw new Error('Title typing changed focus or started a map edit');
  await pane.locator('.mindmap').focus();
  await pane.locator('.mindmap-root-node .mindmap-label').getByText('Mind map',{exact:true}).waitFor();
  for (let attempt = 0; ; attempt++) {
    const saved = await page.evaluate(async ({id,title}) => {
      const options = {cache:'no-store',headers:await glob.getHeaders()};
      const [blob,note] = await Promise.all([
        fetch(`/api/notes/${id}/blob`,options).then(r=>r.json()),
        fetch(`/api/notes/${id}`,options).then(r=>r.json()),
      ]);
      return JSON.parse(blob.content).document.root.text === 'Mind map' && note.title === title;
    }, {id,title});
    if (saved) break;
    if (attempt === 80) throw new Error('Created map title did not persist');
    await page.waitForTimeout(100);
  }
  await waitSaved(pane);
  return {id, pane, branch:result.branch};
}
