import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {connect,request,testRoot,baseUrl} from './test-client.mjs';
import {fit,nativePane,waitSaved} from './test-ui.mjs';

const notes = JSON.parse(await readFile(new URL('spike-notes.json',testRoot),'utf8'));
const connected = await connect();
const browser=connected.browser, context=await browser.newContext({storageState:await connected.context.storageState()});
const page=await context.newPage();await page.goto(`${baseUrl}/#root/${notes.folder}/${notes.A}`);
await page.locator(`.willow-spike[data-note-id="${notes.A}"] [data-ready=true]`).waitFor();
const dir = new URL('evidence/hardening/',testRoot); await mkdir(dir,{recursive:true});
const passed=[],errors=[];
function pass(message){passed.push(message);console.log(message);}
page.on('pageerror',e=>errors.push(e.message));
let peer;
const pane=(p,id)=>p.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
async function poll(fn,description) {
  for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(100);}
  throw new Error(`Timed out: ${description}`);
}
async function content(id){return (await request(page,'GET',`notes/${id}/blob`)).content;}
async function stored(id,text){await poll(async()=>JSON.parse(await content(id)).document.root.text===text,`saved ${text}`);}
async function open(p,id){await p.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());await p.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),id);await pane(p,id).locator('[data-ready=true]').waitFor();}
async function edit(p,id,text,commit=true){await fit(p,pane(p,id));await pane(p,id).locator('.mindmap-root-node .mindmap-label').click();await p.keyboard.press('F2');await pane(p,id).locator('.mindmap textarea').fill(text);if(commit)await p.keyboard.press('Enter');}
const doc=text=>JSON.stringify({format:'trilium-willow-mindmap',version:1,document:{root:{id:'hardening-root',text,children:[{id:'child',text:'Child',side:'right',children:[]}]}}});
let folder,id,other;
try {
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext);
  folder=(await request(page,'POST',`notes/${notes.folder}/children?target=into`,{title:`Willow hardening ${Date.now()}`,type:'text',content:'Disposable persistence checks'})).note.noteId;
  async function create(title){return (await request(page,'POST',`notes/${folder}/children?target=into`,{title,type:'render',mime:'application/json',content:doc(title),attributes:[{type:'relation',name:'renderNote',value:notes.bundle},{type:'label',name:'willowMindMap',value:''}]})).note.noteId;}
  id=await create('Hardening map');other=await create('Unchanged destination');await open(page,id);
  let release,arrived;
  const held=new Promise(r=>arrived=r),gate=new Promise(r=>release=r),writes=[];
  const url=`**/api/notes/${id}/data`;
  await page.route(url,async route=>{writes.push(JSON.parse(route.request().postDataJSON().content).document.root.text);if(writes.length===1){arrived();await gate;}await route.continue();});
  await edit(page,id,'Delayed first');await held;
  await edit(page,id,'Delayed latest');
  const switching=page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),other);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>glob.appContext.tabManager.getActiveContext().note.noteId),id);
  release();await switching;await page.unroute(url);
  await stored(id,'Delayed latest');assert.deepEqual(writes,['Delayed first','Delayed latest']);
  assert.equal(JSON.parse(await content(other)).document.root.text,'Unchanged destination');
  pass('delayed writes serialize newer edits; navigation waits and never writes the destination');

  await open(page,id);
  await page.route(url,route=>route.abort('internetdisconnected'));
  await edit(page,id,'Offline draft');await pane(page,id).getByRole('button',{name:'Retry save',exact:true}).waitFor();
  await page.unroute(url);await pane(page,id).getByRole('button',{name:'Retry save',exact:true}).click();await stored(id,'Offline draft');await waitSaved(pane(page,id));
  pass('network loss keeps the draft and explicit retry saves it');

  peer=await browser.newContext({storageState:await context.storageState()});const second=await peer.newPage();
  await second.goto(baseUrl);await second.waitForFunction(()=>globalThis.glob?.appContext);await open(second,id);
  await edit(second,id,'Independent client update');await stored(id,'Independent client update');
  await pane(page,id).locator('.mindmap-root-node').getByText('Independent client update',{exact:true}).waitFor();
  await edit(page,id,'Unfinished local draft',false);
  await edit(second,id,'Second incoming version');await stored(id,'Second incoming version');
  await pane(page,id).getByRole('button',{name:'Keep both',exact:true}).waitFor();
  assert.equal(await pane(page,id).locator('.mindmap textarea').inputValue(),'Unfinished local draft');
  await pane(page,id).getByRole('button',{name:'Keep both',exact:true}).click();
  const copy=pane(page,id).getByRole('link',{name:'Open recovery copy',exact:true});await copy.waitFor();
  const recovered=(await copy.getAttribute('href')).split('/').at(-1);await stored(recovered,'Unfinished local draft');await stored(id,'Second incoming version');
  pass('independent clients refresh clean maps; competing unfinished work survives in a recovery copy');

  await edit(page,id,'Read-only transition draft',false);
  await request(second,'PUT',`notes/${id}/set-attribute`,{type:'label',name:'readOnly',value:''});
  await pane(page,id).locator('.mindmap[aria-readonly=true]').waitFor();
  assert.equal(JSON.parse(await content(id)).document.root.text,'Second incoming version');
  await pane(page,id).locator('.mindmap').focus();await page.keyboard.type('must not edit');
  assert.equal(await pane(page,id).locator('.mindmap textarea').count(),0);
  const attrs=await request(page,'GET',`notes/${id}/attributes`);const ro=attrs.find(a=>a.name==='readOnly');
  await request(second,'DELETE',`notes/${id}/attributes/${ro.attributeId}`);
  await pane(page,id).locator('.mindmap[aria-readonly=false]').waitFor();
  await pane(page,id).getByRole('button',{name:'Retry save',exact:true}).click();await stored(id,'Read-only transition draft');
  pass('read-only changes preserve unfinished work, block editing, and allow retry after unlocking');

  const revision=await request(page,'POST',`notes/${id}/revision`,{description:'Willow hardening checkpoint'});
  const before=await content(id);await edit(page,id,'After revision checkpoint');await stored(id,'After revision checkpoint');
  await request(second,'POST',`revisions/${revision.revisionId}/restore`);
  await poll(async()=>await content(id)===before,'revision restoration');
  await pane(page,id).locator('.mindmap-root-node').getByText('Read-only transition draft',{exact:true}).waitFor();
  // Revision content arrives before the coordinated root-to-title save settles.
  // Finish that operation before the next scenario intercepts data writes.
  await waitSaved(pane(page,id));
  await poll(async()=>(await request(page,'GET',`notes/${id}`)).title==='Read-only transition draft','restored revision title');
  pass('native revision checkpoints restore exact JSON and refresh the editor');

  await page.route(url,route=>route.abort('internetdisconnected'));
  await edit(page,id,'Draft retained through deletion');
  await pane(page,id).getByRole('button',{name:'Retry save',exact:true}).waitFor();
  await request(second,'DELETE',`notes/${id}?taskId=willow-delete&last=true`);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(id=>JSON.parse(globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id).local).document.root.text,id),'Draft retained through deletion');
  await page.unroute(url);
  let deletedWrite=false;
  await page.route(url,route=>{deletedWrite=true;return route.abort();});
  await page.evaluate(id=>globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id).flush().catch(()=>{}),id);
  await page.unroute(url);
  assert.equal(deletedWrite,false,'Adapter attempted to save a known-deleted note');
  const restored=await request(second,'PUT',`notes/${id}/undelete`,{fallbackParentNoteId:folder});assert.ok(restored.undeleted);
  await open(page,id);const retry=pane(page,id).getByRole('button',{name:'Retry save',exact:true});if(await retry.isVisible())await retry.click();await stored(id,'Draft retained through deletion');
  pass('deletion retains a failed draft in the session; native undelete restores it and navigation/retry saves it');

  const credentials=JSON.parse(await readFile(new URL('credentials.json',testRoot),'utf8'));
  await page.evaluate(()=>{void glob.appContext.triggerCommand('enterProtectedSession');});
  await page.locator('#protected-session-password').fill(credentials.password);
  await page.locator('.protected-session-password-dialog').getByRole('button',{name:'Start protected session',exact:true}).click();
  await poll(()=>page.evaluate(()=>glob.isProtectedSessionAvailable),'protected session');
  await request(page,'PUT',`notes/${id}/protect/1?subtree=0`);
  await open(page,id);await edit(page,id,'Protected map content');await stored(id,'Protected map content');
  const state=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('trilium-willow:'))));
  assert.ok(!JSON.stringify(state).includes('Protected map content'));
  const reloaded=page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame()});
  await page.evaluate(()=>{void glob.appContext.triggerCommand('leaveProtectedSession');});
  await reloaded;
  await page.waitForFunction(()=>globalThis.glob?.isProtectedSessionAvailable===false);
  await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  assert.equal(await pane(page,id).locator('.mindmap').count(),0);
  assert.equal(await page.evaluate(id=>globalThis[Symbol.for('trilium-willow.spike')]?.sessions.get(id)?.local,id),undefined);
  pass('protected maps save inside the protected session; logout removes decrypted editors/drafts and local storage contains only view state');

  await writeFile(new URL('browser.json',dir),JSON.stringify({testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,folder,id,other,recovered,passed,errors},null,2));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed,errors},null,2));
} catch(error){await page.screenshot({path:new URL('failure.png',dir).pathname});await writeFile(new URL('failure.json',dir),JSON.stringify({folder,id,other,passed,error:String(error),errors},null,2));throw error;}
finally{await peer?.close();await context.close();await browser.close();}
