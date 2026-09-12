import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {connect,request,testRoot,baseUrl} from './test-client.mjs';
import {fit} from './test-ui.mjs';
const notes=JSON.parse(await readFile(new URL('spike-notes.json',testRoot),'utf8'));
const connected=await connect(),browser=connected.browser;
const context=await browser.newContext({storageState:await connected.context.storageState()});
const page=await context.newPage();await page.goto(baseUrl);await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
const dir=new URL('evidence/hardening/',testRoot);await mkdir(dir,{recursive:true});
const passed=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const originalTheme=await page.evaluate(()=>glob.theme);
let id;
const pane=()=>page.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
async function open(noteId){await page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),noteId);}
function luminance(color){const values=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2];}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
try {
  const fixture=await request(page,'POST',`notes/${notes.folder}/children?target=into`,{title:`Willow host ${Date.now()}`,type:'render',mime:'application/json',content:JSON.stringify({format:'trilium-willow-mindmap',version:1,document:{root:{id:'host-root',text:'Host integration',children:[{id:'child',text:'Clipboard child',side:'right',children:[]}]}}}),attributes:[{type:'relation',name:'renderNote',value:notes.bundle},{type:'label',name:'willowMindMap',value:''}]});id=fixture.note.noteId;
  await open(id);await pane().locator('[data-ready=true]').waitFor();
  const themeResults=[];
  for(const theme of ['next-light','next-dark']){
    await request(page,'PUT',`options/theme/${theme}`);await page.waitForFunction(theme=>document.body.dataset.themeId===theme,theme);
    await fit(page,pane());await pane().locator('.mindmap-root-node .mindmap-label').click();await page.keyboard.press('F2');
    const colors=await pane().locator('.mindmap textarea').evaluate(e=>({text:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}));
    const ratio=contrast(colors.text,colors.background);themeResults.push({theme,...colors,ratio});
    await page.screenshot({path:new URL(`${theme}.png`,dir).pathname});
    assert.ok(ratio>=4.5,`Unreadable editor in ${theme}: ${JSON.stringify(colors)}, contrast ${ratio}`);
    await page.keyboard.press('Escape');
  }
  passed.push('light and dark themes keep editing text readable');

  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:baseUrl});
  await pane().locator('[data-node-id=child] .mindmap-label').click();await page.keyboard.press('Meta+c');
  const clipboard=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(clipboard.includes('Clipboard child'));
  await pane().locator('.mindmap-root-node .mindmap-label').click();await page.keyboard.press('Meta+v');
  await page.waitForFunction(id=>[...document.querySelectorAll(`.willow-spike[data-note-id="${id}"] .mindmap-node`)].filter(e=>e.textContent==='Clipboard child').length===2,id);
  passed.push('real clipboard copy/paste adds a node within Trilium');

  // Stock subtree export/import, not a dedicated mind-map image export.
  await open(notes.folder);await page.waitForTimeout(150);
  const expected=(await request(page,'GET',`notes/${id}/blob`)).content;
  const exported=await page.evaluate(async branch=>{
    const response=await fetch(`/api/branches/${branch}/export/subtree/html/willow-export`,{headers:await glob.getHeaders()});
    if(!response.ok)throw new Error(`Export: ${response.status}`);
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  },fixture.branch.branchId);
  await writeFile(new URL('map-export.zip',dir),Buffer.from(exported));
  const imported=await page.evaluate(async ({bytes,parent})=>{
    const data=new FormData();data.append('upload',new File([new Uint8Array(bytes)],'map-export.zip',{type:'application/zip'}));
    data.append('taskId','willow-import');data.append('last','true');data.append('safeImport','false');
    const response=await fetch(`/api/notes/${parent}/notes-import`,{method:'POST',headers:await glob.getHeaders(),body:data});
    if(!response.ok)throw new Error(`Import: ${response.status}`);return response.json();
  },{bytes:exported,parent:notes.folder});
  assert.notEqual(imported.noteId,id);assert.equal((await request(page,'GET',`notes/${imported.noteId}/blob`)).content,expected);
  id=imported.noteId;
  const attributes=await request(page,'GET',`notes/${id}/attributes`);
  const externalRelationPreserved=attributes.some(a=>a.name==='renderNote'&&a.value===notes.bundle);
  if(!externalRelationPreserved)await request(page,'PUT',`notes/${id}/set-attribute`,{type:'relation',name:'renderNote',value:notes.bundle});
  await open(id);await pane().locator('[data-ready=true]').waitFor();
  passed.push('native subtree export/import preserves exact JSON; restoring the external editor relation reopens the map');
  assert.deepEqual(errors,[]);const report={testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,id,themeResults,externalRelationPreserved,passed,errors};
  await writeFile(new URL('host.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await page.screenshot({path:new URL('host-failure.png',dir).pathname});console.log((await page.locator('body').innerText()).slice(-700));await writeFile(new URL('host-failure.json',dir),JSON.stringify({id,passed,error:String(error),errors},null,2));throw error;}
finally{await request(page,'PUT',`options/theme/${originalTheme}`);await context.close();await browser.close();}
