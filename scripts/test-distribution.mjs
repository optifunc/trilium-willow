import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createConnection} from 'node:net';
import {chromium} from 'playwright';
import {testRoot} from './test-client.mjs';
import {createFromMenu,waitSaved} from './test-ui.mjs';

const manifest=JSON.parse(await readFile(new URL('../dist/manifest.json',import.meta.url),'utf8'));
const zip=await readFile(new URL(`../dist/trilium-willow-${manifest.version}.zip`,import.meta.url));
const bundle=await readFile(new URL('../dist/willow-editor.jsx',import.meta.url),'utf8');
const hash=data=>createHash('sha256').update(data).digest('hex');
assert.equal(hash(zip),manifest.files[`trilium-willow-${manifest.version}.zip`]);
assert.equal(hash(bundle),manifest.files['willow-editor.jsx']);
const root=fileURLToPath(testRoot);
await mkdir(`${root}/distribution`,{recursive:true});
const run=await mkdtemp(`${root}/distribution/run-`);
const report={testedAt:new Date().toISOString(),manifest,run,clients:[]};
async function until(fn,label){for(let i=0;i<300;i++){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`Timed out: ${label}`);}
async function api(page,method,path,body){return page.evaluate(async({method,path,body})=>{
  if(!['http://127.0.0.1:37848','trilium-app://app'].includes(location.origin))throw new Error('Not a distribution test client');
  const response=await fetch(`/api/${path}`,{method,cache:'no-store',headers:{...await glob.getHeaders(),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();if(!response.ok)throw new Error(`${method} ${path}: ${response.status} ${text.slice(0,300)}`);return text?JSON.parse(text):undefined;
},{method,path,body});}
const raw=async(page,id)=>(await api(page,'GET',`notes/${id}/blob`)).content;
const pane=(page,id)=>page.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
async function open(page,id){
  // Startup can replace the initial context while its first note resolves.
  await until(()=>page.evaluate(async id=>{await glob.appContext.tabManager.getActiveContext().setNote(id);return glob.appContext.tabManager.getActiveContext().noteId===id;},id),`open ${id}`);
}
async function importPackage(page){
  // Import responds before its WebSocket completion selects the new root. Wait
  // for that native navigation to finish before touching any child notes.
  await page.evaluate(()=>{
    const proto=Object.getPrototypeOf(glob.appContext.tabManager.getActiveContext()),original=proto.setNote;
    globalThis.willowImportNavigation={completed:[],restore:()=>{proto.setNote=original;}};
    proto.setNote=async function(...args){const result=await original.apply(this,args);globalThis.willowImportNavigation.completed.push(args[0]);return result;};
  });
  try{
  const result=await page.evaluate(async bytes=>{
  const form=new FormData();form.append('upload',new File([new Uint8Array(bytes)],'willow.zip',{type:'application/zip'}));
  form.append('taskId',`willow-package-${Date.now()}`);form.append('last','true');form.append('safeImport','true');
  const response=await fetch('/api/notes/root/notes-import',{method:'POST',headers:await glob.getHeaders(),body:form});
  if(!response.ok)throw new Error(`Import: ${response.status}`);return response.json();
},Array.from(zip));
  await page.waitForFunction(id=>globalThis.willowImportNavigation.completed.includes(id),result.noteId);
  return result;
  }finally{await page.evaluate(()=>{globalThis.willowImportNavigation.restore();delete globalThis.willowImportNavigation;});}
}
async function parts(page,folder){
  await open(page,folder);
  await page.waitForLoadState('networkidle');
  return page.evaluate(async()=>{
    const children=await glob.appContext.tabManager.getActiveContext().note.getChildNotes();
    const find=title=>{const n=children.find(n=>n.title===title);if(!n)throw new Error(`Missing package child: ${title}`);return n.noteId;};
    return {editor:find('Willow shared editor'),template:find('Willow Mind Map'),example:find('Example mind map')};
  });
}
async function activate(page,id,editor){
  const before=await api(page,'GET',`notes/${id}/attributes`);
  assert.ok(before.some(a=>a.name==='disabled:renderNote'&&a.value===editor),'Safe import must remap and disable the internal relation');
  const title=(await api(page,'GET',`notes/${id}`)).title;
  await page.locator('.fancytree-title').getByText(title,{exact:true}).click();
  const enable=page.getByRole('button',{name:/Enable render note/});
  await enable.click();
  const after=await api(page,'GET',`notes/${id}/attributes`);
  assert.ok(after.some(a=>a.name==='renderNote'&&a.value===editor));
}
async function check(page,client){
  const passed=[];report.clients.push({client,passed});
  const pass=message=>{passed.push(message);console.log(`${client}: ${message}`);};
  await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  assert.equal(await page.evaluate(()=>glob.triliumVersion),'0.105.0');
  const templates=await api(page,'GET','search-templates');
  assert.ok(!JSON.stringify(templates).includes('Willow Mind Map'),'Fresh database already has Willow');
  const imported=await importPackage(page);
  const installed=await parts(page,imported.noteId);
  assert.equal(await raw(page,installed.editor),bundle);
  await activate(page,installed.template,installed.editor);
  await activate(page,installed.example,installed.editor);
  await pane(page,installed.example).locator('[data-ready=true]').waitFor();
  pass('safe import remaps internal relations; native activation opens the bundled example');
  const container=(await api(page,'POST','notes/root/children?target=into',{title:'My mind maps',type:'text',mime:'text/html',content:'<p>User documents outside the add-on.</p>'})).note.noteId;
  await open(page,container);
  const {id}=await createFromMenu(page,'My mind maps','into',`${client} user map`);
  await pane(page,id).locator('.mindmap-root-node .mindmap-label').click();await page.keyboard.press('F2');
  await pane(page,id).locator('textarea').fill('Keep this user document');await page.keyboard.press('Enter');
  await until(async()=>JSON.parse(await raw(page,id)).document.root.text==='Keep this user document','map save');
  await waitSaved(pane(page,id));
  const expected=await raw(page,id);assert.equal(JSON.parse(expected).document.root.text,'Keep this user document');
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  await open(page,id);await pane(page,id).locator('[data-ready=true]').waitFor();
  assert.equal(await raw(page,id),expected);
  pass('native template creation outside the package, editing, saving and reload work');
  // Simulate a previous compatible release, then apply the shipped update file
  // to its existing code note. All IDs and user JSON must remain unchanged.
  await open(page,container);
  await api(page,'PUT',`notes/${installed.editor}/data`,{content:`// Previous compatible release fixture\n${bundle}`});
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  await open(page,id);await pane(page,id).locator('[data-ready=true]').waitFor();
  await open(page,container);
  await api(page,'PUT',`notes/${installed.editor}/data`,{content:bundle});
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  await open(page,id);await pane(page,id).locator('[data-ready=true]').waitFor();
  assert.equal(await raw(page,id),expected);assert.equal(await raw(page,installed.editor),bundle);
  const fresh=await createFromMenu(page,'My mind maps','into',`${client} after update`);
  assert.notEqual(JSON.parse(await raw(page,fresh.id)).document.root.id,JSON.parse(expected).document.root.id);
  pass('replacing shared code preserves existing JSON and template creation with unique root IDs');
  await open(page,container);
  await api(page,'DELETE',`notes/${imported.noteId}?taskId=willow-remove&last=true`);
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  await open(page,id);
  await page.getByText('Display custom HTML or Preact JSX inside this note',{exact:true}).waitFor();
  assert.equal(await raw(page,id),expected);
  assert.equal(await pane(page,id).count(),0);
  const withoutEditor=await page.locator('body').innerText();
  report.clients.at(-1).withoutEditor=withoutEditor.slice(-1500);
  const source=await api(page,'GET',`notes/${id}/blob`);assert.equal(source.content,expected);
  await page.evaluate(()=>glob.appContext.triggerCommand('showNoteSource'));
  await page.locator('.cm-content:visible').filter({hasText:'Keep this user document'}).waitFor();
  await page.screenshot({path:`${run}/${client}-without-addon-source.png`});
  // Leave source mode before testing the reconnected Render Note.
  await page.evaluate(()=>glob.appContext.tabManager.getActiveContext().setNote('root'));
  pass('removing the package leaves external map JSON intact and readable without Willow');
  const replacement=await importPackage(page);const reinstalled=await parts(page,replacement.noteId);
  assert.notEqual(reinstalled.editor,installed.editor);
  await api(page,'PUT',`notes/${id}/set-attribute`,{type:'relation',name:'renderNote',value:reinstalled.editor});
  await api(page,'PUT',`notes/${id}/set-attribute`,{type:'label',name:'willowMindMap',value:''});
  await open(page,id);await pane(page,id).locator('[data-ready=true]').waitFor();
  assert.equal(await raw(page,id),expected);
  pass('reinstalling and reconnecting an old map restores editing without changing its JSON');
  report.clients.at(-1).ids={...installed,folder:imported.noteId,id,reinstalled};
}

for(const port of [37848,37849,39227]){
  const busy=await new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));});
  if(busy)throw new Error(`Distribution test port ${port} is occupied`);
}
let server,desktop,seedServer,browser,native,context;
function launch(executable,args,data,profile,port,logfile){
  const log=openSync(`${run}/${logfile}`,'a');
  const child=spawn(executable,args,{cwd:`${root}/server`,env:{...process.env,TRILIUM_DATA_DIR:data,...(profile?{TRILIUM_ELECTRON_DATA_DIR:profile}:{}),TRILIUM_HOST:'127.0.0.1',TRILIUM_PORT:String(port),TRILIUM_ENV:'production'},stdio:['ignore',log,log]});closeSync(log);return child;
}
try{
  await mkdir(`${run}/server-data`);
  server=launch(process.execPath,['main.cjs'],`${run}/server-data`,null,37848,'server.log');
  await until(async()=>(await fetch('http://127.0.0.1:37848/api/setup/status')).ok,'clean server');
  const setup=await fetch('http://127.0.0.1:37848/api/setup/new-document?skipDemoDb=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale:'en'})});
  assert.ok(setup.ok,await setup.text());
  browser=await chromium.connectOverCDP('http://127.0.0.1:39222');context=await browser.newContext();
  const page=await context.newPage();await page.goto('http://127.0.0.1:37848');
  const credentials=JSON.parse(await readFile(`${root}/credentials.json`,'utf8'));
  await page.locator('input[type=password]').first().fill(credentials.password);
  await page.locator('input[type=password]').nth(1).fill(credentials.password);
  await page.getByRole('button',{name:'Set password',exact:true}).click();
  await page.getByRole('button',{name:'Log in',exact:true}).waitFor();
  await page.locator('input[type=password]').fill(credentials.password);
  await page.getByRole('button',{name:'Log in',exact:true}).click();
  await check(page,'browser');
  // Import the exact same bytes directly into a fresh native desktop database.
  await mkdir(`${run}/desktop-data`);await mkdir(`${run}/desktop-profile`);
  // Initialize an empty database with the stock server before launching the
  // desktop. Native first-run setup replaces its window while returning the
  // setup response, which makes CDP's response context transient.
  seedServer=launch(process.execPath,['main.cjs'],`${run}/desktop-data`,null,37849,'desktop-setup.log');
  await until(async()=>(await fetch('http://127.0.0.1:37849/api/setup/status')).ok,'clean desktop database initializer');
  const desktopSetup=await fetch('http://127.0.0.1:37849/api/setup/new-document?skipDemoDb=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale:'en'})});
  assert.ok(desktopSetup.ok,await desktopSetup.text());
  await new Promise(resolve=>{seedServer.once('exit',resolve);seedServer.kill('SIGTERM');});
  desktop=launch(`${root}/desktop/Trilium Notes.app/Contents/MacOS/trilium`,['--remote-debugging-port=39227','--remote-debugging-address=127.0.0.1'],`${run}/desktop-data`,`${run}/desktop-profile`,37849,'desktop.log');
  await until(async()=>(await fetch('http://127.0.0.1:39227/json/version')).ok,'desktop CDP');
  native=await chromium.connectOverCDP('http://127.0.0.1:39227');
  let nativePage;await until(()=>!!(nativePage=native.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'))),'native renderer');
  nativePage.on('dialog',d=>d.dismiss().catch(()=>{}));
  await nativePage.waitForLoadState('domcontentloaded');
  await check(nativePage,'desktop');
  await writeFile(`${root}/evidence/distribution.json`,JSON.stringify(report,null,2));
}catch(error){report.error=String(error);await writeFile(`${run}/failure.json`,JSON.stringify(report,null,2));throw error;}
finally{await context?.close();await browser?.close();await native?.close();for(const child of [desktop,seedServer,server])if(child?.exitCode===null)child.kill('SIGTERM');}
