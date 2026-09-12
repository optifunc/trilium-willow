import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { connect, request, testRoot } from './test-client.mjs';

const notes = JSON.parse(await readFile(new URL('spike-notes.json', testRoot), 'utf8'));
const { browser, page } = await connect();
const passed = [];
const errors = [];
const dir = new URL('evidence/spike/', testRoot);
await mkdir(dir, { recursive: true });
page.on('pageerror', error => errors.push(error.message));
const pane = name => page.locator(`.willow-spike[data-note-id="${notes[name]}"]:visible`).last();
const tree = name => page.locator('.fancytree-title').getByText(`Willow Map ${name}`, { exact: true });
async function open(name) {
  await tree(name).click();
  await pane(name).locator('.mindmap').waitFor();
  const transfer = pane(name).getByRole('button', { name: 'Edit in this pane', exact: true });
  if (await transfer.isVisible()) await transfer.click();
  await pane(name).locator('.mindmap[aria-readonly="false"]').waitFor();
}
async function editRoot(name, text) {
  await pane(name).locator(`[data-node-id="root-${name}"] .mindmap-label`).click();
  await page.keyboard.press('F2');
  await pane(name).locator('textarea').fill(text);
}
async function stored(name) {
  return JSON.parse((await request(page, 'GET', `notes/${notes[name]}/blob`)).content).document;
}
async function untilStored(name, predicate) {
  for (let i=0; i<60; i++) {
    const document=await stored(name);
    if (predicate(document)) return document;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Timed out waiting for stored Map ${name}`);
}
async function checkLifetime() {
  await page.waitForFunction(() => {
    const d=globalThis[Symbol.for('trilium-willow.spike')];
    return [...d.active.values()].every(v=>v.host.isConnected)
      && d.mounted-d.destroyed===d.active.size
      && d.active.size===document.querySelectorAll('.willow-spike .mindmap').length;
  },undefined,{timeout:5000});
  const result = await page.evaluate(() => {
    const d = globalThis[Symbol.for('trilium-willow.spike')];
    return { mounted:d.mounted, destroyed:d.destroyed, active:d.active.size,
      detached:[...d.active.values()].filter(v=>!v.host.isConnected).length,
      dom:document.querySelectorAll('.willow-spike .mindmap').length };
  });
  assert.equal(result.detached,0,JSON.stringify(result));
  assert.equal(result.mounted-result.destroyed,result.active,JSON.stringify(result));
  assert.equal(result.active,result.dom,JSON.stringify(result));
  return result;
}
try {
  // Fixture setup uses host/API calls; interactions under test below use real input.
  await page.evaluate(() => glob.appContext.tabManager.closeOtherTabsCommand({
    ntxId: glob.appContext.tabManager.getActiveMainContext().ntxId,
  }));
  await page.evaluate(async () => {
    const manager=glob.appContext.tabManager;
    const main=manager.getActiveMainContext().ntxId;
    for (const context of [...manager.noteContexts]) if (context.ntxId!==main) await manager.removeNoteContext(context.ntxId);
    await manager.activateNoteContext(main);
  });
  await page.locator('.fancytree-title').getByText('Willow integration spike',{exact:true}).click();
  for(const name of ['A','B']) await request(page,'PUT',`notes/${notes[name]}/data`,{content:JSON.stringify({
    format:'trilium-willow-mindmap',version:1,document:{root:{id:`root-${name}`,text:`Map ${name}`,children:[
      {id:`left-${name}`,text:'Ideas',side:'left',children:[]},
      {id:`right-${name}`,text:'Next steps',side:'right',checked:false,children:[]},
    ]}},
  })});
  await page.reload();
  await open('A');
  await editRoot('A','Map A saved through the widget');
  await page.keyboard.press('Enter');
  await untilStored('A',d=>d.root.text==='Map A saved through the widget');
  passed.push('shared bundle mounted; committed edit saved in the owning Render Note');

  await page.keyboard.press('Meta+z');
  await untilStored('A',d=>d.root.text==='Map A');
  await page.keyboard.press('Meta+Shift+z');
  await untilStored('A',d=>d.root.text==='Map A saved through the widget');
  passed.push('widget undo/redo through real keyboard input and save echoes');

  await page.keyboard.press('Tab');
  await pane('A').locator('textarea').fill('Child committed by leaving the note');
  await open('B');
  await untilStored('A',d=>d.root.children.some(n=>n.text==='Child committed by leaving the note'));
  assert.equal((await stored('B')).root.text,'Map B');
  passed.push('provisional child committed on pointer navigation; no cross-note write');

  await editRoot('B','Map B committed by keyboard navigation');
  await page.keyboard.press('Meta+[');
  await pane('A').locator('.mindmap').waitFor({timeout:5000});
  await untilStored('B',d=>d.root.text==='Map B committed by keyboard navigation');
  passed.push('unfinished label committed on Trilium keyboard back navigation');

  await editRoot('A','Map A committed by refresh');
  const mountedBefore = await page.evaluate(()=>globalThis[Symbol.for('trilium-willow.spike')].mounted);
  await page.locator('button.bx-refresh:visible').click();
  await page.waitForFunction(before=>globalThis[Symbol.for('trilium-willow.spike')].mounted>before,mountedBefore);
  await untilStored('A',d=>d.root.text==='Map A committed by refresh');
  await checkLifetime();
  passed.push('native Render Note refresh commits editing and disposes the previous editor');

  for(let i=0;i<3;i++){await open('B');await open('A');}
  await checkLifetime();
  passed.push('repeated A/B navigation keeps editor counts and DOM consistent');

  await tree('A').click({button:'right'});
  await page.getByText('Open in a new split',{exact:false}).click();
  await page.waitForFunction(id=>[...document.querySelectorAll(`.willow-spike[data-note-id="${id}"]`)]
    .filter(e=>e.getBoundingClientRect().width>0).length===2,notes.A);
  const views=page.locator(`.willow-spike[data-note-id="${notes.A}"]:visible`);
  await views.nth(1).locator('.mindmap').waitFor();
  assert.equal(await views.locator('.mindmap[aria-readonly="false"]').count(),1);
  assert.equal(await views.locator('.mindmap[aria-readonly="true"]').count(),1);
  const viewerId=await views.filter({has:page.getByRole('button',{name:'Edit in this pane',exact:true})}).getAttribute('data-willow-context');
  const viewer=page.locator(`.willow-spike[data-willow-context="${viewerId}"]`);
  await viewer.getByRole('button',{name:'Edit in this pane',exact:true}).click();
  await viewer.locator('.mindmap[aria-readonly="false"]').waitFor();
  assert.equal(await views.locator('.mindmap[aria-readonly="false"]').count(),1);
  for(const view of await views.all()) await view.getByRole('button',{name:'Fit map',exact:true}).click();
  await checkLifetime();
  await page.screenshot({path:new URL('two-panes.png',dir).pathname,fullPage:true});
  passed.push('two views of one map mount separately; one writer with explicit ownership transfer');

  // Closing the whole split tab goes through the native tab close control.
  const editable=views.filter({has:page.locator('.mindmap[aria-readonly="false"]')});
  await editable.locator('[data-node-id="root-A"] .mindmap-label').click();
  await page.keyboard.press('F2');
  await editable.locator('textarea').fill('Map A survived closing its split tab');
  await page.locator('.note-tab[active] .note-tab-close').click();
  await untilStored('A',d=>d.root.text==='Map A survived closing its split tab');
  await checkLifetime();
  passed.push('tab close commits an unfinished label and disposes split editors');

  const validB=(await request(page,'GET',`notes/${notes.B}/blob`)).content;
  for(const content of [JSON.stringify({format:'trilium-willow-mindmap',version:2,document:{root:{}}}),
    JSON.stringify({format:'trilium-willow-mindmap',version:1,document:{root:{id:'bad',text:42,children:[]}}})]) {
    await request(page,'PUT',`notes/${notes.B}/data`,{content});
    await tree('B').click();
    await pane('B').getByRole('alert').waitFor();
    assert.equal(await pane('B').locator('.mindmap').count(),0);
    await pane('B').getByRole('button',{name:'Save',exact:true}).click();
    assert.equal((await request(page,'GET',`notes/${notes.B}/blob`)).content,content);
    await page.locator('.fancytree-title').getByText('Willow integration spike',{exact:true}).click();
  }
  await request(page,'PUT',`notes/${notes.B}/data`,{content:validB});
  passed.push('unsupported version and invalid map fail visibly without overwriting source');

  await open('A');
  await page.reload();
  await pane('A').locator('.mindmap-label').getByText('Map A survived closing its split tab',{exact:true}).waitFor();
  const lifetime=await checkLifetime();
  await page.screenshot({path:new URL('reopened.png',dir).pathname,fullPage:true});
  assert.deepEqual(errors,[]);
  passed.push('reload and reopen preserve the document; no browser page errors');
  const report={testedAt:new Date().toISOString(),version:'0.105.0',bundleSha256:notes.bundleSha256,passed,lifetime,errors};
  await writeFile(new URL('results.json',dir),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} catch(error) {
  await page.screenshot({path:new URL('failure.png',dir).pathname,fullPage:true});
  await writeFile(new URL('failure.json',dir),JSON.stringify({passed,error:String(error),stack:error.stack,errors},null,2));
  throw error;
} finally { await browser.close(); }
