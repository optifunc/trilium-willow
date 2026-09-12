import assert from 'node:assert/strict';
import {fit} from './test-ui.mjs';

export async function checkReviewRegressions(page,notes) {
  await page.evaluate(async()=>{
    const m=glob.appContext.tabManager,main=m.getActiveMainContext().ntxId;
    for(const c of [...m.noteContexts])if(c.ntxId!==main)await m.removeNoteContext(c.ntxId);
    await m.activateNoteContext(main);
  });
  const api=(method,path,body)=>page.evaluate(async ({method,path,body})=>{
    const r=await fetch(`/api/${path}`,{method,cache:'no-store',headers:{...await glob.getHeaders(),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!r.ok)throw new Error(`${method} ${path}: ${r.status}`);const s=await r.text();return s?JSON.parse(s):undefined;
  },{method,path,body});
  const title=`Willow review ${Date.now()}`;
  const doc=text=>JSON.stringify({format:'trilium-willow-mindmap',version:1,document:{root:{id:'root',text,children:[
    {id:'alpha',text:'Alpha',side:'left',children:[]},{id:'beta',text:'Beta',side:'right',children:[]},
  ]}}});
  const id=(await api('POST',`notes/${notes.folder}/children?target=into`,{title,type:'render',mime:'application/json',content:doc('Review'),
    attributes:[{type:'label',name:'willowMindMap',value:''},{type:'relation',name:'renderNote',value:notes.bundle}]})).note.noteId;
  await page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),id);
  const pane=ctx=>page.locator(`.willow-spike[data-note-id="${id}"]${ctx?`[data-willow-context="${ctx}"]`:''}:visible`).last();
  await pane().locator('[data-ready=true]').waitFor();
  const first=await pane().getAttribute('data-willow-context');
  const state=ctx=>page.evaluate(({id,ctx})=>{
    const [instance,v]=[...globalThis[Symbol.for('trilium-willow.spike')].active].find(([,v])=>v.noteId===id&&v.host.isConnected&&v.host.parentElement.dataset.willowContext===ctx);
    const el=v.host.querySelector('.mindmap'),p=v.editor.getViewport();
    return {instance,selection:v.editor.getSelection(),zoom:p.zoom,centerX:(el.clientWidth/2-p.x)/p.zoom,centerY:(el.clientHeight/2-p.y)/p.zoom};
  },{id,ctx});
  const same=(a,b)=>{assert.deepEqual(a.selection,b.selection);for(const key of ['zoom','centerX','centerY'])assert.ok(Math.abs(a[key]-b[key])<.02,JSON.stringify({a,b}));};
  async function refresh(ctx) {
    const before=(await state(ctx)).instance;
    await page.evaluate(ntxId=>glob.appContext.triggerEvent('refreshData',{ntxId}),ctx);
    await page.waitForFunction(({id,ctx,before})=>[...globalThis[Symbol.for('trilium-willow.spike')].active]
      .some(([key,v])=>key!==before&&v.noteId===id&&v.host.isConnected&&v.host.dataset.ready==='true'&&v.host.parentElement.dataset.willowContext===ctx),{id,ctx,before});
  }
  const passed=[];
  await pane(first).locator('[data-node-id=alpha] .mindmap-label').click();await page.keyboard.press('Meta+=');
  const alpha=await state(first);assert.equal(alpha.zoom,1.2);
  await page.locator('.fancytree-title').getByText(title,{exact:true}).click({button:'right'});
  await page.getByText('Open in a new split',{exact:false}).click();
  await page.waitForFunction(id=>[...document.querySelectorAll(`.willow-spike[data-note-id="${id}"]`)].filter(e=>e.clientWidth).length===2,id);
  const second=await page.locator(`.willow-spike[data-note-id="${id}"]:not([data-willow-context="${first}"]):visible`).last().getAttribute('data-willow-context');
  assert.notEqual(first,second);
  await pane(second).locator('[data-ready=true]').waitFor();
  await pane(second).locator('[data-node-id=beta] .mindmap-label').click();
  await page.keyboard.press('Meta+0');await page.keyboard.press('Meta+=');await page.keyboard.press('Meta+=');
  const beta=await state(second);assert.ok(Math.abs(beta.zoom-1.44)<.001);
  await refresh(first);same(await state(first),alpha);same(await state(second),beta);
  await refresh(second);same(await state(first),alpha);same(await state(second),beta);
  passed.push('refreshing either split preserves its own zoom, centre, selection and active node');

  for(const variant of ['refresh','ownership']) {
    await page.evaluate(ctx=>glob.appContext.tabManager.activateNoteContext(ctx),first);
    const take=pane(first).getByRole('button',{name:'Edit here',exact:true});if(await take.isVisible())await take.click();
    await pane(first).locator('.mindmap[aria-readonly=false]').waitFor();await fit(page,pane(first));
    await pane(first).locator('.mindmap-root-node .mindmap-label').click();await page.keyboard.press('F2');
    await pane(first).locator('textarea').fill(`Copied ${variant}`);
    await api('PUT',`notes/${id}/data`,{content:doc(`Incoming ${variant}`)});
    await pane(first).getByRole('button',{name:'Keep both',exact:true}).waitFor();
    await page.evaluate(id=>{
      const original=window.fetch;let release;const gate=new Promise(r=>release=r);
      const fault={arrived:false,release,restore:()=>{window.fetch=original;release();}};globalThis.willowRecoveryFault=fault;
      window.fetch=async function(input,...args){
        const url=String(input?.url??input),s=globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id);
        if(!fault.arrived&&s.recovering&&s.recovered&&url.includes(`notes/${id}/blob`)){fault.arrived=true;await gate;}
        return original.call(this,input,...args);
      };
    },id);
    try {
      await pane(first).getByRole('button',{name:'Keep both',exact:true}).click();
      await page.waitForFunction(()=>globalThis.willowRecoveryFault.arrived);
      const copy=await page.evaluate(id=>globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id).recovered,id);
      if(variant==='refresh')await refresh(first);
      assert.equal(await pane(first).locator('.willow-spike-host').evaluate(e=>e.inert),true);
      const transfer=pane(second).getByRole('button',{name:'Edit here',exact:true});assert.equal(await transfer.isDisabled(),true);
      await transfer.evaluate(e=>e.click()); // Disabled controls cannot transfer ownership.
      assert.equal(await pane(second).locator('.mindmap').getAttribute('aria-readonly'),'true');
      // Bypass the UI lock deliberately: the session's generation guard must
      // also protect a draft delivered by any future/programmatic editing path.
      await page.evaluate(({id,ctx,text})=>{
        const v=[...globalThis[Symbol.for('trilium-willow.spike')].active.values()].find(v=>v.noteId===id&&v.host.isConnected&&v.host.parentElement.dataset.willowContext===ctx);
        v.editor.execute({type:'setText',targetId:'root',text});
      },{id,ctx:first,text:`Newer ${variant}`});
      await page.evaluate(()=>globalThis.willowRecoveryFault.release());
      await page.waitForFunction(id=>!globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id).recovering,id);
      const session=await page.evaluate(id=>{const s=globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id);return {local:s.local,state:s.state};},id);
      assert.equal(JSON.parse(session.local).document.root.text,`Newer ${variant}`);assert.equal(session.state,'conflict');
      assert.equal(JSON.parse((await api('GET',`notes/${copy}/blob`)).content).document.root.text,`Copied ${variant}`);
      assert.equal((await api('GET',`notes/${id}/blob`)).content,doc(`Incoming ${variant}`));
      await pane(first).getByRole('button',{name:'Keep both',exact:true}).click();
      await page.waitForFunction(id=>{const s=globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id);return !s.recovering&&s.state==='saved';},id);
      const latest=await page.evaluate(id=>globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id).recovered,id);
      assert.notEqual(latest,copy);assert.equal(JSON.parse((await api('GET',`notes/${latest}/blob`)).content).document.root.text,`Newer ${variant}`);
      if(variant==='ownership'){await transfer.click();await pane(second).locator('.mindmap[aria-readonly=false]').waitFor();}
      passed.push(`delayed recovery with ${variant} retains the copy and newer draft; shared busy state blocks transfer and retry preserves both`);
    } finally {await page.evaluate(()=>{globalThis.willowRecoveryFault.restore();delete globalThis.willowRecoveryFault;});}
  }
  await page.evaluate(async ctx=>{await glob.appContext.tabManager.removeNoteContext(ctx);},second);
  await pane(first).locator('[data-ready=true]').waitFor();await fit(page,pane(first));
  const map=pane(first).locator('.mindmap'),box=await map.boundingBox();
  await page.mouse.move(box.x+25,box.y+30);await page.mouse.down();
  await page.mouse.move(box.x+65,box.y+30,{steps:4});await page.waitForTimeout(400);
  const paused=await state(first);
  await page.mouse.move(box.x+145,box.y+30,{steps:6});await page.mouse.up();
  const final=await state(first);assert.ok(Math.abs(final.centerX-paused.centerX)>10);
  await page.waitForFunction(({id,x})=>Math.abs(JSON.parse(localStorage.getItem(`trilium-willow:view:v1:${id}`)).centerX-x)<.02,{id,x:final.centerX});
  await page.reload();await pane().locator('[data-ready=true]').waitFor();
  same(await state(await pane().getAttribute('data-willow-context')),final);
  passed.push('a drag paused beyond the debounce persists its final position through a fresh reload');
  return {id,passed};
}
