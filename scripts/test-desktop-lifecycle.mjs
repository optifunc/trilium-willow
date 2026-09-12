import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer,request as httpRequest} from 'node:http';
import {createConnection} from 'node:net';
import {openSync,closeSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {connect,testRoot,baseUrl} from './test-client.mjs';
import {fit} from './test-ui.mjs';

const proxyUrl='http://127.0.0.1:37847';
for(const port of [37846,37847,39226]) {
  const busy=await new Promise(resolve=>{const s=createConnection({host:'127.0.0.1',port});s.on('connect',()=>{s.destroy();resolve(true);});s.on('error',()=>resolve(false));});
  if(busy)throw new Error(`Isolated desktop lifecycle port ${port} is occupied.`);
}
const notes=JSON.parse(await readFile(new URL('spike-notes.json',testRoot),'utf8'));
const credentials=JSON.parse(await readFile(new URL('credentials.json',testRoot),'utf8'));
const connected=await connect(),browser=connected.browser;
const context=await browser.newContext({storageState:await connected.context.storageState()});
const primary=await context.newPage();await primary.goto(baseUrl);await primary.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
let online=true,delay=0,proxyRequests=0,child,desktop,page;
const proxy=createServer((req,res)=>{
  proxyRequests++;
  if(!online){res.writeHead(503);res.end('Test desktop sync offline');return;}
  setTimeout(()=>{
    if(res.destroyed)return;
    const upstream=httpRequest({hostname:'127.0.0.1',port:37841,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
    upstream.on('error',()=>{if(!res.destroyed){res.writeHead(502);res.end();}});req.pipe(upstream);
  },delay);
});
await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(37847,'127.0.0.1',resolve);});
const path=name=>fileURLToPath(new URL(name,testRoot));
await mkdir(path('lifecycle-data'),{recursive:true});await mkdir(path('lifecycle-profile'),{recursive:true});
const passed=[];
function pass(s){passed.push(s);console.log(s);}
async function until(fn,label,attempts=200){for(let i=0;i<attempts;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error(`Timed out: ${label}`);}
const api=(p,method,path,body)=>p.evaluate(async({method,path,body})=>{
  const r=await fetch(`/api/${path}`,{method,cache:'no-store',headers:{...await glob.getHeaders(),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!r.ok)throw new Error(`${method} ${path}: ${r.status}`);const text=await r.text();return text?JSON.parse(text):undefined;
},{method,path,body});
const raw=async(p,id)=>(await api(p,'GET',`notes/${id}/blob`)).content;
const pane=(p,id)=>p.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
async function open(p,id){await p.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),id);await pane(p,id).locator('[data-ready=true]').waitFor();}
async function edit(p,id,text,commit=true){await fit(p,pane(p,id));await pane(p,id).locator('.mindmap-root-node .mindmap-label').click();await p.keyboard.press('F2');await pane(p,id).locator('textarea').fill(text);if(commit){await p.keyboard.press('Enter');await until(async()=>JSON.parse(await raw(p,id)).document.root.text===text,`saved ${text}`);}}
async function launch() {
  const log=openSync(path('lifecycle-desktop.log'),'a');
  child=spawn(path('desktop/Trilium Notes.app/Contents/MacOS/trilium'),['--remote-debugging-port=39226','--remote-debugging-address=127.0.0.1'],{
    cwd:path(''),stdio:['ignore',log,log],env:{...process.env,TRILIUM_DATA_DIR:path('lifecycle-data'),TRILIUM_ELECTRON_DATA_DIR:path('lifecycle-profile'),TRILIUM_PORT:'37846',TRILIUM_HOST:'127.0.0.1',TRILIUM_ENV:'production'},
  });closeSync(log);
  await writeFile(path('lifecycle-desktop.pid'),`${child.pid}\n`);
  await until(async()=>{if(child.exitCode!==null)throw new Error(`Desktop exited: ${child.exitCode}`);try{return (await fetch('http://127.0.0.1:39226/json/version')).ok;}catch{return false;}},'desktop CDP');
  desktop=await chromium.connectOverCDP('http://127.0.0.1:39226');
  await until(async()=>{page=desktop.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'));return !!page;},'native renderer');
  page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  await page.waitForLoadState('domcontentloaded');
  // Desktop APIs are reached through its authenticated local protocol. Direct
  // HTTP access is intentionally restricted by the stock desktop security layer.
  const status=await page.evaluate(async()=>(await fetch('/api/setup/status')).json());
  if(!status.isInitialized){
    const result=await page.evaluate(async body=>(await fetch('/api/setup/sync-from-server',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json(),{syncServerHost:proxyUrl,password:credentials.password});
    assert.equal(result.result,'success');
    await page.reload();
  }
  await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  assert.equal(await page.evaluate(()=>glob.isElectron),true);
  // Close the window for real, rather than hiding it in the macOS tray.
  await api(page,'PUT','options/closeToTray/false');await api(page,'PUT','options/disableTray/true');
  await api(page,'PUT',`options/syncServerHost/${encodeURIComponent(proxyUrl)}`);
}
async function reopenWindow() {
  // macOS keeps the app running after its last window closes. Exercise its
  // native second-instance/new-window path rather than replacing the database.
  const launcher=spawn(path('desktop/Trilium Notes.app/Contents/MacOS/trilium'),['--new-window'],{
    cwd:path(''),stdio:'ignore',env:{...process.env,TRILIUM_DATA_DIR:path('lifecycle-data'),TRILIUM_ELECTRON_DATA_DIR:path('lifecycle-profile'),TRILIUM_PORT:'37846',TRILIUM_HOST:'127.0.0.1',TRILIUM_ENV:'production'},
  });
  await until(async()=>launcher.exitCode!==null,'new-window launcher');
  await until(async()=>{page=desktop.contexts()[0].pages().find(p=>!p.isClosed()&&p.url().startsWith('trilium-app:'));return !!page;},'reopened desktop window');
  page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
}
async function faultWrite(id,mode) {
  await page.evaluate(({id,mode})=>{
    const original=window.fetch;let release;const gate=new Promise(r=>release=r);
    const fault={arrived:false,release,restore:()=>{window.fetch=original;release();}};globalThis.willowCloseFault=fault;
    window.fetch=async function(input,init){
      if(String(input?.url??input).includes(`notes/${id}/data`)&&init?.method==='PUT'){
        fault.arrived=true;
        if(mode==='fail')return new Response('Test failed write',{status:503});
        await gate;
      }
      return original.call(this,input,init);
    };
  },{id,mode});
}
try {
  await launch();
  const id=(await api(primary,'POST',`notes/${notes.folder}/children?target=into`,{title:`Willow desktop lifecycle ${Date.now()}`,type:'render',mime:'application/json',
    content:JSON.stringify({format:'trilium-willow-mindmap',version:1,document:{root:{id:'desktop-root',text:'Desktop baseline',children:[]}}}),
    attributes:[{type:'label',name:'willowMindMap',value:''},{type:'relation',name:'renderNote',value:notes.bundle}]})).note.noteId;
  await api(page,'POST','sync/now');await until(async()=>{try{return await raw(page,id)===await raw(primary,id);}catch{return false;}},'initial desktop sync');
  assert.equal(await raw(page,notes.bundle),await raw(primary,notes.bundle));await open(page,id);await open(primary,id);
  pass('native desktop receives the shared bundle and map through real server synchronization');
  for(const mode of ['delay','fail']) {
    await edit(page,id,`Unfinished before ${mode} close`,false);await faultWrite(id,mode);
    await page.evaluate(()=>electronApi.window.closeWindow());
    await page.waitForFunction(()=>globalThis.willowCloseFault.arrived);
    await page.waitForTimeout(350);assert.equal(page.isClosed(),false,'Window closed before its write completed');
    if(mode==='fail')await pane(page,id).getByRole('button',{name:'Retry save',exact:true}).waitFor();
    await page.evaluate(()=>{globalThis.willowCloseFault.restore();delete globalThis.willowCloseFault;});
    if(mode==='fail')await pane(page,id).getByRole('button',{name:'Retry save',exact:true}).click();
    await until(async()=>JSON.parse(await raw(page,id)).document.root.text===`Unfinished before ${mode} close`,'close-triggered save');
    await page.waitForFunction(id=>{const s=globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id);return !s.dirty&&!s.saving&&!s.editing;},id);
    const closed=page.waitForEvent('close');await page.evaluate(()=>electronApi.window.closeWindow()).catch(()=>{});await closed;
    await reopenWindow();await open(page,id);
    assert.equal(JSON.parse(await raw(page,id)).document.root.text,`Unfinished before ${mode} close`);
    pass(`native window close commits an unfinished label, waits on a ${mode==='delay'?'delayed':'failed'} write, and preserves the saved label when a new native window opens`);
  }
  await api(page,'POST','sync/now');await until(async()=>await raw(page,id)===await raw(primary,id),'close edits synchronize');
  // Delay the real server link while desktop retains an unfinished local label.
  await edit(page,id,'Desktop draft during delayed sync',false);
  await open(primary,id);
  await edit(primary,id,'Server edit during delayed sync');delay=250;
  const count=proxyRequests,syncing=api(page,'POST','sync/now');
  await new Promise(r=>setTimeout(r,150));
  assert.equal(await pane(page,id).locator('textarea').inputValue(),'Desktop draft during delayed sync');
  await syncing;delay=0;assert.ok(proxyRequests>count);
  await pane(page,id).getByRole('button',{name:'Keep both',exact:true}).waitFor();
  await pane(page,id).getByRole('button',{name:'Keep both',exact:true}).click();
  await page.waitForFunction(id=>{const s=globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id);return !s.recovering&&s.state==='saved';},id);
  const copy=await page.evaluate(id=>globalThis[Symbol.for('trilium-willow.spike')].sessions.get(id).recovered,id);
  assert.equal(JSON.parse(await raw(page,copy)).document.root.text,'Desktop draft during delayed sync');
  assert.equal(JSON.parse(await raw(page,id)).document.root.text,'Server edit during delayed sync');
  await api(page,'POST','sync/now');await until(async()=>{try{return await raw(page,copy)===await raw(primary,copy);}catch{return false;}},'desktop recovery copy sync');
  pass('delayed desktop/server sync preserves an unfinished desktop draft in a recovery copy and syncs that copy');
  online=false;await edit(page,id,'Offline desktop saved edit');assert.equal(JSON.parse(await raw(primary,id)).document.root.text,'Server edit during delayed sync');
  online=true;await api(page,'POST','sync/now');await until(async()=>await raw(page,id)===await raw(primary,id),'offline desktop reconnect');
  pass('desktop saves locally while the server is offline and uploads on reconnection');
  online=false;await edit(page,id,'Acknowledged offline desktop version');await edit(primary,id,'Acknowledged competing server version');
  online=true;await api(page,'POST','sync/now');await until(async()=>await raw(page,id)===await raw(primary,id),'offline conflict convergence');
  const winner=JSON.parse(await raw(page,id)).document.root.text;
  assert.ok(['Acknowledged offline desktop version','Acknowledged competing server version'].includes(winner));
  pass('competing acknowledged offline desktop/server edits converge according to native whole-document sync');
  const report={testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,id,copy,passed,concurrentSync:{winner,limitation:'Native sync does not guarantee retaining both already-acknowledged competing documents.'}};
  await writeFile(path('evidence/desktop-lifecycle.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  const closed=page.waitForEvent('close');await page.evaluate(()=>electronApi.window.closeWindow()).catch(()=>{});await closed;
} finally {
  online=true;await context.close();await browser.close();await desktop?.close();
  if(child?.exitCode===null)child.kill('SIGTERM');
  proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));
}
