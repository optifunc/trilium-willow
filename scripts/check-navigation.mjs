import assert from 'node:assert/strict';

// Intercept the request boundary because Electron's custom local protocol does
// not pass through Playwright's HTTP routing. All hooks are restored in finally.
async function delayBundles(page,bundle,holdFirst=false) {
  await page.evaluate(({bundle,holdFirst})=>{
    const prototype=XMLHttpRequest.prototype,open=prototype.open,send=prototype.send,urls=new WeakMap();
    let release;const gate=new Promise(r=>release=r);
    const state={arrived:false,count:0,release,restore:()=>{prototype.open=open;prototype.send=send;release();}};
    globalThis.willowBundleDelay=state;
    prototype.open=function(method,url,...args){urls.set(this,String(url));return open.call(this,method,url,...args);};
    prototype.send=function(...args){
      if(urls.get(this)?.includes(`script/bundle/${bundle}`)){
        state.count++;const wait=holdFirst&&state.count===1?(state.arrived=true,gate):holdFirst?Promise.resolve():new Promise(r=>setTimeout(r,180));
        void wait.then(()=>{if(this.readyState===1)send.apply(this,args);});return;
      }
      return send.apply(this,args);
    };
  },{bundle,holdFirst});
}
async function restoreBundles(page){await page.evaluate(()=>{globalThis.willowBundleDelay?.restore();delete globalThis.willowBundleDelay;});}

export async function checkNavigation(page, notes) {
  const tree = title => page.locator('.fancytree-title').getByText(title,{exact:true});
  const pane = id => page.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
  await tree('Willow Map A').click();
  await pane(notes.A).locator('[data-ready="true"]').waitFor();
  const geometry = () => pane(notes.A).locator('.mindmap-node').evaluateAll(es => es.map(e => ({
    text:e.textContent,width:e.style.width,height:e.style.height,left:e.style.left,top:e.style.top,
  })));
  const baseline = await geometry();
  assert.ok(baseline.every(n=>parseFloat(n.width)>2&&parseFloat(n.height)>2));
  for (let i=0;i<3;i++) {
    await tree('Willow browser control smoke test').click();
    await page.locator('.note-detail-editable-text:visible').waitFor();
    assert.equal(await page.locator('.willow-transition').count(),0);
    await tree('Willow Map A').click();
    await pane(notes.A).locator('[data-ready="true"]').waitFor();
    await page.waitForTimeout(100);
    assert.deepEqual(await geometry(),baseline,'Normal-note transition corrupted map layout');
  }
  const switches = [];
  // Make the host's bundle-loading gap long enough to observe reliably.
  await delayBundles(page,notes.bundle);
  try {
    for (const [title,id] of [['Willow Map B',notes.B],['Willow Map A',notes.A]]) {
      await page.evaluate(() => {
        const container = [...document.querySelectorAll('.willow-spike')].find(e=>e.checkVisibility()).closest('.scrolling-container');
        globalThis.willowPaintFrames = [];
        globalThis.willowPaintRecording = true;
        const frame = () => {
          if (!globalThis.willowPaintRecording) return;
          const visible = selector => [...container.querySelectorAll(selector)].some(e=>e.checkVisibility());
          globalThis.willowPaintFrames.push({live:visible('.willow-spike .mindmap'),preview:visible('.willow-transition .mindmap')});
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      await tree(title).click();
      await pane(id).locator('[data-ready="true"]').waitFor();
      await page.waitForTimeout(100);
      const frames = await page.evaluate(()=>{globalThis.willowPaintRecording=false;return globalThis.willowPaintFrames;});
      assert.ok(frames.some(f=>f.preview),'No transition preview was observed');
      assert.ok(frames.every(f=>f.live||f.preview),`Blank paint frame: ${JSON.stringify(frames)}`);
      assert.equal(await page.locator('.willow-transition').count(),0,'Preview outlived replacement');
      switches.push({id,frames});
    }
    assert.ok(await page.evaluate(()=>globalThis.willowBundleDelay.count)>=2);
  } finally {await restoreBundles(page);}
  // The native Render component caches its last note while a text note is open.
  // Leave B in that cache so returning to A must issue a new bundle request.
  await tree('Willow Map B').click();await pane(notes.B).locator('[data-ready=true]').waitFor();
  await tree('Willow browser control smoke test').click();
  await page.locator('.note-detail-editable-text:visible').waitFor();
  await delayBundles(page,notes.bundle,true);
  try {
    await tree('Willow Map A').click();await page.waitForFunction(()=>globalThis.willowBundleDelay.arrived,undefined,{timeout:10000});
    await tree('Willow Map B').click();await pane(notes.B).locator('[data-ready=true]').waitFor();
    await pane(notes.B).locator('.mindmap-root-node .mindmap-label').click();await page.keyboard.press('F2');
    await pane(notes.B).locator('.mindmap textarea').fill('Draft survives stale bundle completion');
    await page.evaluate(()=>globalThis.willowBundleDelay.release());await page.waitForTimeout(350);
    await pane(notes.B).locator('.mindmap[aria-readonly=false]').waitFor();
    await pane(notes.B).locator('.mindmap-root-node .mindmap-label').getByText('Draft survives stale bundle completion',{exact:true}).waitFor();
    for(let i=0;;i++){
      const saved=await page.evaluate(async id=>JSON.parse((await(await fetch(`/api/notes/${id}/blob`,{cache:'no-store',headers:await glob.getHeaders()})).json()).content).document.root.text,notes.B);
      if(saved==='Draft survives stale bundle completion')break;
      if(i===60)throw new Error('Draft was lost on stale bundle completion');
      await page.waitForTimeout(100);
    }
  } finally {await restoreBundles(page);}
  return {normalNoteRoundTrips:3,switches,staleBundle:'current map remains editable and unfinished text persists'};
}
