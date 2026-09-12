import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { connect, request, testRoot } from './test-client.mjs';

const notes = JSON.parse(await readFile(new URL('spike-notes.json', testRoot), 'utf8'));
const { browser, page } = await connect();
const dir = new URL('evidence/vertical-slice/', testRoot);
await mkdir(dir, { recursive: true });
const passed = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const pane = id => page.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
async function raw(id) { return (await request(page, 'GET', `notes/${id}/blob`)).content; }
async function untilDocument(id, predicate) {
  for (let i=0;i<80;i++) {
    const document=JSON.parse(await raw(id)).document;
    if(predicate(document))return document;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for committed map ${id}`);
}
async function saved(id, text) {
  await untilDocument(id,document=>document.root.text===text);
  await pane(id).getByRole('status').getByText('Saved',{exact:true}).waitFor();
}
async function edit(id, text) {
  await pane(id).getByRole('button',{name:'Fit map',exact:true}).click();
  await pane(id).locator('.mindmap-root-node .mindmap-label').click();
  await page.keyboard.press('F2');
  await pane(id).locator('.mindmap textarea').fill(text);
}
async function view(id, contextId) {
  return page.evaluate(({id,contextId})=>{
    const v=[...globalThis[Symbol.for('trilium-willow.spike')].active.values()].find(v=>v.noteId===id&&v.host.isConnected&&v.host.clientWidth>0&&(!contextId||v.host.parentElement.dataset.willowContext===contextId));
    const el=v.host.querySelector('.mindmap'), p=v.editor.getViewport();
    return {zoom:p.zoom,centerX:(el.clientWidth/2-p.x)/p.zoom,centerY:(el.clientHeight/2-p.y)/p.zoom};
  },{id,contextId});
}
function closeView(a,b) { for(const key of ['zoom','centerX','centerY']) assert.ok(Math.abs(a[key]-b[key])<.02,`${key}: ${JSON.stringify({a,b})}`); }
let id;
try {
  await page.evaluate(async()=>{
    const m=glob.appContext.tabManager, main=m.getActiveMainContext().ntxId;
    for(const c of [...m.noteContexts]) if(c.ntxId!==main)await m.removeNoteContext(c.ntxId);
    await m.activateNoteContext(main);
  });
  await page.locator('.fancytree-title').getByText('Create a Willow mind map',{exact:true}).click();
  const title=`Willow acceptance ${Date.now()}`;
  await page.getByRole('textbox',{name:'Map title',exact:true}).fill(title);
  await page.getByRole('button',{name:'Create map',exact:true}).click();
  const link=page.getByRole('link',{name:'Open new map',exact:true});
  await link.waitFor();
  id=(await link.getAttribute('href')).split('/').at(-1);
  await link.click();
  await pane(id).locator('.mindmap').waitFor();
  closeView(await view(id),{zoom:1,centerX:0,centerY:0});
  assert.equal(JSON.parse(await raw(id)).document.root.text,title);
  assert.equal((await request(page,'GET',`notes/${id}`)).type,'render');
  passed.push('creation UI makes a separate Render Note, initializes its root title, and opens centred at 100%');

  await pane(id).locator('.mindmap-root-node .mindmap-label').click({button:'right'});
  await pane(id).getByRole('menuitem',{name:/^Add child/}).click();
  await pane(id).locator('.mindmap textarea').fill('Task');await page.keyboard.press('Enter');
  await pane(id).locator('.mindmap-label').getByText('Task',{exact:true}).click({button:'right'});
  await pane(id).getByRole('menuitem',{name:/^Insert parent/}).click();
  await pane(id).locator('.mindmap textarea').fill('Group');await page.keyboard.press('Enter');
  await pane(id).locator('.mindmap-label').getByText('Group',{exact:true}).click({button:'right'});
  await pane(id).getByRole('menuitem',{name:'Add checkbox',exact:true}).click();
  await pane(id).locator('.mindmap-checkbox').click();
  await pane(id).locator('.mindmap-label').getByText('Group',{exact:true}).click({button:'right'});
  await pane(id).getByRole('menuitem',{name:/^Collapse/}).click();
  await untilDocument(id,document=>{
    const child=document.root.children[0];
    return child?.text==='Group'&&child.checked&&child.collapsed&&child.children[0]?.text==='Task';
  });
  passed.push('native widget menus restructure nodes and save checkbox/collapse state');

  const original=await raw(id);
  await pane(id).locator('.mindmap').click({position:{x:20,y:20}});
  await page.keyboard.press('Meta+=');
  await pane(id).locator('.mindmap').hover({position:{x:20,y:20}});
  await page.mouse.wheel(130,90);
  await page.waitForFunction(id=>localStorage.getItem(`trilium-willow:view:v1:${id}`),id);
  const remembered=await view(id);
  assert.ok(remembered.zoom>1);assert.ok(Math.abs(remembered.centerX)>1);
  await page.locator('.fancytree-title').getByText('Willow Map B',{exact:true}).click();
  await page.locator('.fancytree-title').getByText(title,{exact:true}).click();
  await pane(id).locator('.mindmap').waitFor();closeView(await view(id),remembered);
  await page.reload();await pane(id).locator('.mindmap').waitFor();closeView(await view(id),remembered);
  assert.equal(await raw(id),original);
  passed.push('pan/zoom survives note switches and reload without changing note content');

  const beforeSize=await view(id);
  await page.setViewportSize({width:1180,height:820});
  await page.waitForTimeout(150);closeView(await view(id),beforeSize);
  await page.locator('.fancytree-title').getByText(title,{exact:true}).click({button:'right'});
  await page.getByText('Open in a new split',{exact:false}).click();
  const views=page.locator(`.willow-spike[data-note-id="${id}"]:visible`);
  await page.waitForFunction(id=>[...document.querySelectorAll(`.willow-spike[data-note-id="${id}"]`)].filter(e=>e.clientWidth>0).length===2,id);
  await views.nth(1).locator('.mindmap').waitFor();
  const left=await views.nth(0).getAttribute('data-willow-context'), right=await views.nth(1).getAttribute('data-willow-context');
  const leftBefore=await view(id,left);
  await views.nth(1).getByRole('button',{name:'Fit map',exact:true}).click();await page.waitForTimeout(300);
  closeView(await view(id,left),leftBefore);
  const rightBefore=await view(id,right);
  const transfer=views.getByRole('button',{name:'Edit in this pane',exact:true});
  await transfer.click();await page.waitForTimeout(200);
  closeView(await view(id,left),leftBefore);closeView(await view(id,right),rightBefore);
  passed.push('resizing and editing transfer preserve the centre; split panes keep independent views');
  await page.evaluate(async()=>{
    const m=glob.appContext.tabManager, main=m.getActiveMainContext().ntxId;
    for(const c of [...m.noteContexts])if(c.ntxId!==main)await m.removeNoteContext(c.ntxId);
    await m.activateNoteContext(main);
  });
  await page.locator('.fancytree-title').getByText(title,{exact:true}).click();
  const take=pane(id).getByRole('button',{name:'Edit in this pane',exact:true});if(await take.isVisible())await take.click();

  const saveUrl=`**/api/notes/${id}/data`;
  await page.route(saveUrl,route=>route.fulfill({status:503,body:'Temporary test failure'}));
  await edit(id,'Draft retained after failed save');await page.keyboard.press('Enter');
  await pane(id).getByRole('button',{name:'Retry save',exact:true}).waitFor();
  assert.equal(await raw(id),original);
  await page.unroute(saveUrl);
  await pane(id).getByRole('button',{name:'Retry save',exact:true}).click();
  await saved(id,'Draft retained after failed save');
  passed.push('failed save reports failure, retains the draft, and Retry persists it');

  await edit(id,'Local work recovered including unfinished text');
  const incoming=JSON.parse(await raw(id));incoming.document.root.text='Incoming version retained';
  await request(page,'PUT',`notes/${id}/data`,{content:JSON.stringify(incoming)});
  await pane(id).getByRole('button',{name:'Keep both',exact:true}).waitFor();
  assert.equal(await pane(id).locator('.mindmap textarea').inputValue(),'Local work recovered including unfinished text');
  await page.route(`**/api/notes/${notes.folder}/children?target=into`,route=>route.fulfill({status:503,body:'Temporary recovery failure'}));
  await pane(id).getByRole('button',{name:'Keep both',exact:true}).click();
  await pane(id).getByRole('alert').getByText(/Recovery did not finish/).waitFor();
  await page.unroute(`**/api/notes/${notes.folder}/children?target=into`);
  await pane(id).getByRole('button',{name:'Keep both',exact:true}).click();
  const recovered=pane(id).getByRole('link',{name:'Open recovery copy',exact:true});await recovered.waitFor();
  const recoveryId=(await recovered.getAttribute('href')).split('/').at(-1);
  await saved(id,'Incoming version retained');
  assert.equal(JSON.parse(await raw(recoveryId)).document.root.text,'Local work recovered including unfinished text');
  passed.push('detected conflict retains unfinished text; failed Keep both is retryable; recovery copy and incoming original both survive');

  await edit(id,'Local text to explicitly discard');
  const discardIncoming=JSON.parse(await raw(id));discardIncoming.document.root.text='Incoming after explicit discard';
  await request(page,'PUT',`notes/${id}/data`,{content:JSON.stringify(discardIncoming)});
  await pane(id).getByRole('button',{name:'Use incoming',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await pane(id).locator('.mindmap-root-node .mindmap-label').getByText('Local text to explicitly discard',{exact:true}).waitFor();
  await pane(id).getByRole('button',{name:'Use incoming',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();
  await saved(id,'Incoming after explicit discard');
  passed.push('Use incoming requires confirmation; Cancel retains the draft, OK loads the saved original');

  await page.reload();await pane(id).locator('.mindmap-root-node .mindmap-label').getByText('Incoming after explicit discard',{exact:true}).waitFor();
  assert.equal(JSON.parse(await raw(recoveryId)).document.root.text,'Local work recovered including unfinished text');
  await page.screenshot({path:new URL('browser.png',dir).pathname,fullPage:true});
  assert.deepEqual(errors,[]);
  const report={testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,id,recoveryId,passed,errors};
  await writeFile(new URL('browser.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} catch(error) {
  await page.screenshot({path:new URL('failure.png',dir).pathname,fullPage:true});
  await writeFile(new URL('failure.json',dir),JSON.stringify({id,passed,error:String(error),stack:error.stack,errors},null,2));
  throw error;
} finally {await browser.close();}
