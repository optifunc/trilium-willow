import assert from 'node:assert/strict';
import {delayBundles,restoreBundles} from './check-navigation.mjs';

// Shared real-input checks for HTTP and the desktop's local protocol.
export async function checkSelectionFocus(page,notes) {
  async function api(method,path,body) {
    return page.evaluate(async ({method,path,body})=>{
      const r=await fetch(`/api/${path}`,{method,cache:'no-store',headers:{...await glob.getHeaders(),'Content-Type':'application/json'},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(!r.ok)throw new Error(`${method} ${path}: ${r.status}`);
      const text=await r.text();return text?JSON.parse(text):undefined;
    },{method,path,body});
  }
  const content=JSON.stringify({format:'trilium-willow-mindmap',version:1,document:{root:{id:'root',text:'Selection test',children:[
    {id:'left',text:'Left',side:'left',children:[]},
    {id:'right',text:'Right',side:'right',collapsed:true,children:[{id:'hidden',text:'Hidden',children:[]}]},
  ]}}});
  const fixtures=[];
  for(const suffix of ['A','B']) {
    const title=`Willow selection ${Date.now()} ${suffix}`;
    const result=await api('POST',`notes/${notes.folder}/children?target=into`,{title,type:'render',mime:'application/json',content,
      attributes:[{type:'label',name:'willowMindMap',value:''},{type:'relation',name:'renderNote',value:notes.bundle}]});
    fixtures.push({id:result.note.noteId,title});
  }
  const [a,b]=fixtures;
  const tree=f=>page.locator('.fancytree-title').getByText(f.title,{exact:true});
  const pane=f=>page.locator(`.willow-spike[data-note-id="${f.id}"]:visible`).last();
  async function ready(f){await pane(f).locator('[data-ready=true]').waitFor();}
  async function focused(f) {
    await page.waitForFunction(id=>document.activeElement?.matches('.mindmap')&&document.activeElement.closest('.willow-spike')?.dataset.noteId===id,f.id,{timeout:8000});
  }
  async function state(f) {
    return page.evaluate(id=>{
      const v=[...globalThis[Symbol.for('trilium-willow.spike')].active.values()].find(v=>v.noteId===id&&v.host.isConnected&&v.host.clientWidth);
      const el=v.host.querySelector('.mindmap'),p=v.editor.getViewport();
      return {selection:v.editor.getSelection(),zoom:p.zoom,centerX:(el.clientWidth/2-p.x)/p.zoom,centerY:(el.clientHeight/2-p.y)/p.zoom};
    },f.id);
  }
  function sameView(a,b) {for(const key of ['zoom','centerX','centerY'])assert.ok(Math.abs(a[key]-b[key])<.02,JSON.stringify({a,b}));}
  async function multi() {
    await pane(a).locator('[data-node-id=left] .mindmap-label').click();
    await pane(a).locator('[data-node-id=right] .mindmap-label').click({modifiers:['Meta']});
  }
  const passed=[];
  await tree(a).click();await ready(a);await focused(a);
  await page.keyboard.press('ArrowRight');
  assert.equal((await state(a)).selection.activeId,'right');
  passed.push('tree click focuses the map; the next arrow navigates its selection');

  await multi();await page.keyboard.press('Meta+=');
  await pane(a).locator('.mindmap').hover({position:{x:20,y:20}});await page.mouse.wheel(35,20);
  await page.waitForFunction(id=>{
    const v=JSON.parse(localStorage.getItem(`trilium-willow:view:v1:${id}`));
    return v?.selection?.ids.length===2&&v.selection.activeId==='right'&&v.zoom>1;
  },a.id);
  const remembered=await state(a);
  await tree(b).click();await ready(b);await focused(b);
  assert.deepEqual((await state(b)).selection,{ids:['root'],activeId:'root'});
  await pane(b).locator('[data-node-id=left] .mindmap-label').click();
  await tree(a).click();await ready(a);await focused(a);
  assert.deepEqual((await state(a)).selection,remembered.selection);sameView(await state(a),remembered);
  await page.reload();await ready(a);
  assert.deepEqual((await state(a)).selection,remembered.selection);sameView(await state(a),remembered);
  passed.push('multi-selection, active node, zoom and position survive switching and reload independently per document');

  // Clicking the already-open tree item must transfer focus out of the title too.
  await page.locator('input.note-title:visible').last().click();
  await tree(a).click();await focused(a);await page.keyboard.press('ArrowLeft');
  assert.equal((await state(a)).selection.activeId,'root');
  assert.equal(await pane(a).locator('.mindmap textarea').count(),0);
  passed.push('clicking the already-open note returns keyboard focus to the map');

  // Simulate view state predating deleted nodes or a remote collapse. Keep only
  // surviving visible IDs; all stale/hidden IDs fall back to the root.
  await tree(b).click();await ready(b);
  async function seedSelection(ids,activeId) {
    await page.evaluate(({id,ids,activeId})=>{
      const key=`trilium-willow:view:v1:${id}`,view=JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key,JSON.stringify({...view,selection:{ids,activeId}}));
    },{id:a.id,ids,activeId});
    // Start a fresh frontend so this exercises persisted defaults, not the
    // independent snapshot retained by the existing pane context.
    await page.reload();await ready(b);
  }
  await seedSelection(['missing','hidden','left'],'missing');
  await tree(a).click();await ready(a);await focused(a);
  assert.deepEqual((await state(a)).selection,{ids:['left'],activeId:'left'});sameView(await state(a),remembered);
  await tree(b).click();await ready(b);await seedSelection(['missing','hidden'],'hidden');
  await tree(a).click();await ready(a);await focused(a);
  assert.deepEqual((await state(a)).selection,{ids:['root'],activeId:'root'});sameView(await state(a),remembered);
  passed.push('deleted/hidden saved IDs are ignored, with root fallback and no viewport movement');

  // A same-document refresh must keep the current selection, rather than reset
  // it to the widget's initial root selection.
  await multi();const selected=(await state(a)).selection;
  const updated=JSON.parse(content);updated.document.root.text='Incoming root label';
  await api('PUT',`notes/${a.id}/data`,{content:JSON.stringify(updated)});
  await pane(a).locator('.mindmap-root-node').getByText('Incoming root label',{exact:true}).waitFor();
  assert.deepEqual((await state(a)).selection,selected);sameView(await state(a),remembered);
  passed.push('incoming content refresh preserves the current selection');

  await tree(b).click();await ready(b);
  await delayBundles(page,notes.bundle,true);
  try {
    await tree(a).click();await page.waitForFunction(()=>globalThis.willowBundleDelay.arrived,undefined,{timeout:8000});
    const title=page.locator('input.note-title:visible').last();
    await title.click();
    await page.evaluate(()=>globalThis.willowBundleDelay.release());await ready(a);await page.waitForTimeout(200);
    assert.equal(await title.evaluate(e=>e===document.activeElement),true,'Loading map stole title focus');
    await page.keyboard.press('Meta+ArrowRight');await page.keyboard.type(' renamed',{delay:25});
    assert.equal(await title.inputValue(),`${a.title} renamed`);
    assert.equal(await pane(a).locator('.mindmap textarea').count(),0);
  } finally {await restoreBundles(page);}
  passed.push('a title click during delayed map loading cancels focus transfer and typing stays in the title');
  assert.equal((await api('GET',`notes/${a.id}/blob`)).content,JSON.stringify(updated));
  assert.equal((await api('GET',`notes/${b.id}/blob`)).content,content);
  passed.push('selection and focus do not modify either document');
  // Commit the disposable title edit before the caller navigates or closes.
  await pane(a).locator('.mindmap').focus();
  return {fixtures,passed};
}
