import assert from 'node:assert/strict';

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
  const bundleUrl = `**/api/script/bundle/${notes.bundle}`;
  await page.route(bundleUrl,async route=>{await page.waitForTimeout(180);await route.continue();});
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
  } finally {await page.unroute(bundleUrl);}
  return {normalNoteRoundTrips:3,switches};
}
