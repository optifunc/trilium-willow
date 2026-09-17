// Real Trilium integration, restricted by test-client to the disposable local server.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { connect, request, testRoot } from './test-client.mjs';
import { waitSaved } from './test-ui.mjs';
import { getKeymapReference, formatShortcut, isMacPlatform } from '../mr/dist/mindmap.js';
const notes = JSON.parse(await readFile(new URL('spike-notes.json', testRoot), 'utf8'));
const { browser, page } = await connect();
const dir = new URL('evidence/chrome/', testRoot); await mkdir(dir, {recursive:true});
const report = {testedAt:new Date().toISOString(), bundleSha256:notes.bundleSha256, passed:[], errors:[]};
const pass = text => { report.passed.push(text); console.log(text); };
page.on('pageerror', error => report.errors.push(error.message));
const leaf = (id,text,extra={}) => ({id,text,children:[],...extra});
const document = {root:leaf('root','Field guide',{children:[
  leaf('purpose','Purpose',{side:'left',children:[leaf('audience','A calmer workspace'),leaf('principle','Keep the map in focus')]}),
  leaf('research','Research',{side:'left',children:[leaf('notes','Collect field notes',{checked:true}),leaf('interviews','Three short interviews',{checked:false}),leaf('archive','Reference archive',{collapsed:true,children:[leaf('hidden1','Previous studies'),leaf('hidden2','Reading list')]})]}),
  leaf('structure','Structure',{side:'right',children:[leaf('outline','Draft the outline',{checked:false}),leaf('examples','Choose examples',{checked:true}),leaf('link','https://triliumnotes.org')]}),
  leaf('publish','Publish',{side:'right',children:[leaf('review','Review together',{checked:false}),leaf('release','Share the first edition')]}),
  leaf('later','Next iteration',{side:'right',collapsed:true,children:[leaf('feedback','Gather feedback')]})
]})};
let id;
const pane = () => page.locator(`.willow-spike[data-note-id="${id}"]:visible`);
const button = action => pane().locator(`button[data-action="${action}"]`);
async function editor(fn,arg) {
  return page.evaluate(({id,fn,arg}) => {
    const view = [...globalThis[Symbol.for('trilium-willow.spike')].active.values()].find(v=>v.noteId===id&&v.host.clientWidth);
    return (0,eval)(`(${fn})`)(view.editor,arg,view.host);
  },{id,fn:fn.toString(),arg});
}
async function resize(width) {
  await pane().evaluate((e,width)=> { e.style.width=`${width}px`; e.style.maxWidth='none'; },width);
  await page.waitForTimeout(80);
}
async function capture(name) { await pane().screenshot({path:fileURLToPath(new URL(`${name}.png`,dir))}); }
async function create(title,type,mime,content,parent=notes.folder) {
  return (await request(page,'POST',`notes/${parent}/children?target=into`,{title,type,mime,content,isProtected:false})).note.noteId;
}
async function open(noteId) {
  await page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),noteId);
}
const snapshot = () => editor((e,_,host)=>{const el=host.querySelector('.mindmap'),v=e.getViewport();return {zoom:v.zoom,x:(el.clientWidth/2-v.x)/v.zoom,y:(el.clientHeight/2-v.y)/v.zoom,selection:e.getSelection()};});
function closeView(a,b) { for(const key of ['zoom','x','y']) assert.ok(Math.abs(a[key]-b[key])<.02,`${key}: ${JSON.stringify({a,b})}`); assert.deepEqual(a.selection,b.selection); }
try {
  await page.setViewportSize({width:2300,height:960});
  await page.evaluate(async()=>{const m=glob.appContext.tabManager,main=m.getActiveMainContext().ntxId;for(const c of [...m.noteContexts])if(c.ntxId!==main)await m.removeNoteContext(c.ntxId);await m.activateNoteContext(main);});
  id = await create('Field guide','render','application/json',JSON.stringify({format:'trilium-willow-mindmap',version:1,document}));
  report.noteId=id;
  await request(page,'PUT',`notes/${id}/attributes`,[
    {type:'label',name:'willowMindMap',value:'',isInheritable:false},
    {type:'relation',name:'renderNote',value:notes.bundle,isInheritable:false}
  ]);
  await open(id); await pane().locator('.willow-spike-host[data-ready="true"]').waitFor(); await resize(1134);
  assert.equal(await pane().locator('.willow-toolbar').evaluate(e=>e.offsetHeight),41);
  assert.equal(await pane().locator('.willow-statusbar').evaluate(e=>e.offsetHeight),30);
  assert.equal(await pane().locator('.willow-context').textContent(),'');
  // First interaction is a chrome zoom button, before any canvas pointer event.
  await button('plus').click(); assert.equal((await snapshot()).zoom,1.1);
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem(`trilium-willow:view:v1:${id}`)||'null')?.zoom===1.1,id);
  await editor(e=>e.setZoom(.532146)); await button('plus').click(); assert.equal((await snapshot()).zoom,.632146);
  assert.equal(await button('percentage').innerText(),'63%');
  await button('percentage').click(); assert.equal((await snapshot()).zoom,1);
  await editor(e=>e.setZoom(.25)); await page.waitForFunction(id=>document.querySelector(`.willow-spike[data-note-id="${id}"] [data-action="minus"]`)?.disabled,id); assert.equal(await button('minus').isDisabled(),true);
  await editor(e=>e.setZoom(4)); await page.waitForFunction(id=>document.querySelector(`.willow-spike[data-note-id="${id}"] [data-action="plus"]`)?.disabled,id); assert.equal(await button('plus').isDisabled(),true);
  await button('fit').click();
  pass('41px/30px bars; additive zoom, fitted precision, reset, clamps and first-interaction persistence');
  await editor(e=>e.setSelection(['outline'],'outline'));
  const add = await button('insertAfter').elementHandle();
  await button('edit').click(); await pane().locator('textarea').fill('Edited from toolbar');
  await button('insertAfter').click();
  assert.equal(await add.evaluate(e=>e===document.querySelector('.willow-spike:has(.mindmap) [data-action="insertAfter"]')),true);
  await pane().locator('textarea').fill('Created from toolbar'); await page.keyboard.press('Enter');
  await button('undo').click();
  assert.equal(await editor(e=>JSON.stringify(e.getDocument()).includes('Created from toolbar')),false);
  assert.equal(await editor(e=>JSON.stringify(e.getDocument()).includes('Edited from toolbar')),true);
  await button('undo').click(); await waitSaved(pane());
  pass('Pointer activation commits the active label, preserves button identity and makes insertion one undo step');
  await editor(e=>e.setSelection(['outline'],'outline'));
  await button('edit').click();
  await pane().locator('textarea').dispatchEvent('compositionstart');
  await button('insertChild').click();
  assert.equal(await pane().locator('textarea').count(),1);
  assert.equal(await editor(e=>e.getSelection().activeId),'outline');
  await pane().locator('textarea').dispatchEvent('compositionend'); await page.keyboard.press('Escape');
  pass('Composition guard blocks toolbar activation without finishing the label');
  await button('more').click(); assert.equal(await pane().getByRole('menu').count(),1);
  await button('more').click(); assert.equal(await pane().getByRole('menu').count(),0);
  for(const width of [1134,651,650,440,421,420,361,360,320,280,279,240]) {
    await resize(width);
    assert.equal(await pane().locator('.willow-toolbar').evaluate(e=>e.scrollWidth<=e.clientWidth),true,`overflow ${width}`);
    const visible = await pane().locator('.willow-toolbar button').evaluateAll(items=>items.filter(e=>e.checkVisibility()).map(e=>e.dataset.action));
    assert.equal(visible.includes('edit'),width>650);assert.equal(visible.includes('undo'),width>360);
    await button('more').click();
    const labels=await pane().locator('.mindmap-menu-label').allTextContents();
    assert.equal(labels.includes('Edit'),width<=650);assert.equal(labels.includes('Undo'),width<=360);
    assert.equal(labels.includes('Keyboard shortcuts'),width<=650);
    assert.equal(labels.includes('Add child'),false);
    assert.equal(await pane().getByRole('menu').evaluate(e=>!!e.firstElementChild?.matches('[role="separator"]')||!!e.lastElementChild?.matches('[role="separator"]')),false);
    if(width===320)await capture('light-320-more');
    await page.keyboard.press('Escape');
    assert.equal(await button('more').evaluate(e=>e===document.activeElement),true);
  }
  pass('Responsive controls and More at every boundary, no horizontal overflow, second-click close and Escape focus return');
  await resize(1134); await button('percentage').click(); await capture('light-full');
  const before = await snapshot(), raw=(await request(page,'GET',`notes/${id}/blob`)).content;
  await button('more').click(); await pane().getByRole('menuitem',{name:'Hide UI',exact:true}).click();
  await page.waitForTimeout(80); closeView(await snapshot(),before); await capture('hidden');
  assert.equal(await pane().locator('.willow-toolbar').isVisible(),false);
  await pane().locator('.mindmap').focus(); await page.keyboard.press('Shift+F10');
  await pane().getByRole('menuitem',{name:'Show UI',exact:true}).click();
  await page.waitForTimeout(80); closeView(await snapshot(),before);
  assert.equal((await request(page,'GET',`notes/${id}/blob`)).content,raw);
  pass('Hide/show releases bars, preserves world center/zoom/selection and saved content, restores via keyboard context menu');
  await button('help').click(); const dialog=pane().getByRole('dialog'); await dialog.waitFor();
  const mac=isMacPlatform(await page.evaluate(()=>navigator.platform));
  for(const action of getKeymapReference()) assert.equal(await dialog.locator(`[data-action="${action.id}"] kbd`).textContent(),action.bindings.map(b=>formatShortcut(b,mac)).join(' / '));
  await dialog.screenshot({path:fileURLToPath(new URL('shortcuts.png',dir))}); await page.keyboard.press('Escape');
  assert.equal(await button('help').evaluate(e=>e===document.activeElement),true);
  await button('insertChild').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await button('insertAfter').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('End'); assert.equal(await button('documentation').evaluate(e=>e===document.activeElement),true);
  pass('Dialog reference matches every widget binding and alternate; modal return focus and toolbar roving keys');
  await pane().locator('.mindmap').focus(); await page.mouse.move(0,0);
  await button('insertChild').evaluate(e=>{globalThis.tipStart=performance.now();globalThis.tipDelay=undefined;const o=new MutationObserver(()=>{if(document.querySelector('.willow-tooltip')){globalThis.tipDelay=performance.now()-globalThis.tipStart;o.disconnect();}});o.observe(document.body,{subtree:true,childList:true});e.dispatchEvent(new PointerEvent('pointerenter'));});
  await page.waitForFunction(()=>globalThis.tipDelay!==undefined);
  const delay=await page.evaluate(()=>globalThis.tipDelay); assert.ok(delay>=190&&delay<600,`tooltip ${delay}`);
  const tipBox=await pane().getByRole('tooltip').boundingBox(),anchorBox=await button('insertChild').boundingBox();
  assert.ok(Math.abs(tipBox.y-anchorBox.y-anchorBox.height-6)<2,`tooltip position ${JSON.stringify({tipBox,anchorBox})}`);
  await button('more').click(); assert.equal(await pane().getByRole('tooltip').count(),0); await page.keyboard.press('Escape');
  pass('Tooltip appears after 200ms, anchors to its control and dismisses for menus');
  for(const width of [1134,440,320]) {
    await resize(width); await capture(`light-${width}`);
    await pane().evaluate(e=>{e.style.setProperty('--main-background-color','#202124');e.style.setProperty('--main-text-color','#e5e5e5');e.style.setProperty('--main-border-color','#494b50');e.style.setProperty('--accented-background-color','#35363a');});
    await capture(`dark-${width}`);
    await pane().evaluate(e=>{for(const name of ['--main-background-color','--main-text-color','--main-border-color','--accented-background-color'])e.style.removeProperty(name);});
  }
  // Recovery is an actual session state; retain enabled host actions outside inert.
  await resize(320);
  await page.evaluate(id=>{const s=globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id);s._recovering=true;s.notify();},id);
  await pane().locator('.willow-context').getByText('Recovering…',{exact:true}).waitFor();
  assert.equal(await button('insertChild').isDisabled(),true);
  await button('more').click(); await pane().getByRole('menuitem',{name:'Keyboard shortcuts',exact:true}).click(); await dialog.waitFor(); await page.keyboard.press('Escape');
  await button('more').click(); await pane().getByRole('menuitem',{name:'Hide UI',exact:true}).click();
  await page.waitForTimeout(100); await pane().focus(); await page.keyboard.press('Shift+F10'); await pane().getByRole('menuitem',{name:'Show UI',exact:true}).click(); await capture('recovery');
  await page.evaluate(id=>{const s=globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id);s._recovering=false;s.notify();},id);
  pass('Recovery disables editor actions while overflow help and hidden-UI keyboard recovery remain usable');
  await resize(1134); await button('documentation').click();
  await pane().getByRole('alert').getByText('Documentation is unavailable for this installation.',{exact:true}).waitFor();
  // A separate installation with a renamed help note proves public API navigation.
  const guide=await create('Renamed Willow help','text','text/html','<p>Isolated guide fixture</p>');
  await request(page,'PUT',`notes/${guide}/set-attribute`,{type:'label',name:'willowAddon',value:''});
  const code=await create('Shared code','code','text/jsx',await readFile(new URL('../dist/willow-spike.js',import.meta.url),'utf8'),guide);
  await request(page,'PUT',`notes/${id}/set-attribute`,{type:'relation',name:'renderNote',value:code});
  await page.reload();await pane().locator('.willow-spike-host[data-ready="true"]').waitFor();await resize(1134);
  await button('documentation').click();
  await page.waitForFunction(id=>glob.appContext.tabManager.getActiveContext().note?.noteId===id,guide);
  pass('Missing documentation reports an error; renamed guide opens in a new native tab via the associated installation');
  await open(id);await pane().locator('.willow-spike-host[data-ready="true"]').waitFor();
  await request(page,'PUT',`notes/${id}/data`,{content:'invalid original bytes'});
  await pane().getByRole('button',{name:'View original source',exact:true}).waitFor();
  await button('more').click();await pane().getByRole('menuitem',{name:'Hide UI',exact:true}).click();
  await page.waitForTimeout(100);await pane().focus();await page.keyboard.press('Shift+F10');await pane().getByRole('menuitem',{name:'Show UI',exact:true}).click();
  assert.equal((await request(page,'GET',`notes/${id}/blob`)).content,'invalid original bytes');
  pass('Invalid original bytes remain untouched and hidden UI is recoverable without an editor');
  assert.deepEqual(report.errors,[]);
} catch(error) { report.failure=String(error); throw error; } finally {
  if(id) await page.evaluate(id=>{const s=globalThis[Symbol.for('trilium-willow.spike')]?.sessions.get(id);if(s){s._recovering=false;s.notify();}},id).catch(()=>{});
  if(id) await request(page,'PUT',`notes/${id}/data`,{content:JSON.stringify({format:'trilium-willow-mindmap',version:1,document})}).catch(()=>{});
  await writeFile(new URL('report.json',dir),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
