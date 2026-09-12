import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {spawn} from 'node:child_process';
import {createConnection} from 'node:net';
import {openSync,closeSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {connect,request,testRoot,baseUrl} from './test-client.mjs';
import {fit} from './test-ui.mjs';

const peerUrl='http://127.0.0.1:37844',proxyUrl='http://127.0.0.1:37845';
for(const port of [37844,37845]){
  const busy=await new Promise(resolve=>{
    const socket=createConnection({host:'127.0.0.1',port});
    socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));
  });
  if(busy)throw new Error(`Test port ${port} is occupied; stop the existing test peer before running this check.`);
}
const notes=JSON.parse(await readFile(new URL('spike-notes.json',testRoot),'utf8'));
const credentials=JSON.parse(await readFile(new URL('credentials.json',testRoot),'utf8'));
const connected=await connect();const browser=connected.browser;
const mainContext=await browser.newContext({storageState:await connected.context.storageState()});
const page=await mainContext.newPage();await page.goto(baseUrl);await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
let online=true,peer,child;
// A loopback proxy allows real backend synchronization to go offline without
// stopping the primary server or altering any user's network configuration.
const proxy=createServer((req,res)=>{
  if(!online){res.writeHead(503);res.end('Test sync link offline');return;}
  const upstream=httpRequest({hostname:'127.0.0.1',port:37841,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
});
await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(37845,'127.0.0.1',resolve);});
async function until(fn,label){for(let i=0;i<200;i++){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`Timed out: ${label}`);}
async function api(p,method,path,body){return p.evaluate(async ({method,path,body})=>{
  const response=await fetch(`/api/${path}`,{method,cache:'no-store',headers:{...await glob.getHeaders(),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)throw new Error(`${method} ${path}: ${response.status}`);const text=await response.text();return text?JSON.parse(text):undefined;
},{method,path,body});}
const pane=(p,id)=>p.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
async function open(p,id){await p.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());await p.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),id);await pane(p,id).locator('[data-ready=true]').waitFor();}
async function raw(p,id){return (await api(p,'GET',`notes/${id}/blob`)).content;}
async function edit(p,id,text){await fit(p,pane(p,id));await pane(p,id).locator('.mindmap-root-node .mindmap-label').click();await p.keyboard.press('F2');await pane(p,id).locator('.mindmap textarea').fill(text);await p.keyboard.press('Enter');await until(async()=>JSON.parse(await raw(p,id)).document.root.text===text,`saved ${text}`);}
const passed=[];
try {
  const data=new URL('sync-data/',testRoot);
  await mkdir(data,{recursive:true});
  const log=openSync(new URL('sync-server.log',testRoot),'a');
  child=spawn(process.execPath,['main.cjs'],{cwd:fileURLToPath(new URL('server/',testRoot)),env:{...process.env,TRILIUM_DATA_DIR:fileURLToPath(data),TRILIUM_HOST:'127.0.0.1',TRILIUM_PORT:'37844',TRILIUM_ENV:'production'},stdio:['ignore',log,log]});closeSync(log);
  await writeFile(new URL('sync-server.pid',testRoot),`${child.pid}\n`);
  await until(async()=>child.exitCode===null&&(await fetch(`${peerUrl}/api/setup/status`)).ok,'peer server');
  const status=await(await fetch(`${peerUrl}/api/setup/status`)).json();
  if(!status.isInitialized){
    const setup=await fetch(`${peerUrl}/api/setup/sync-from-server`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({syncServerHost:proxyUrl,password:credentials.password})});
    const result=await setup.json();assert.equal(result.result,'success',JSON.stringify(result));
  }
  peer=await browser.newContext();const second=await peer.newPage();await second.goto(peerUrl);
  await second.waitForFunction(()=>document.querySelector('input[type=password]')||globalThis.glob?.appContext?.tabManager?.getActiveContext());
  if(await second.locator('input[type=password]').isVisible()){
    await second.locator('input[type=password]').fill(credentials.password);await second.getByRole('button',{name:'Log in',exact:true}).click();
  }
  await second.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  const id=(await request(page,'POST',`notes/${notes.folder}/children?target=into`,{title:`Willow sync ${Date.now()}`,type:'render',mime:'application/json',content:JSON.stringify({format:'trilium-willow-mindmap',version:1,document:{root:{id:'sync-root',text:'Sync baseline',children:[]}}}),attributes:[{type:'relation',name:'renderNote',value:notes.bundle},{type:'label',name:'willowMindMap',value:''}]})).note.noteId;
  await api(second,'POST','sync/now');
  await until(async()=>await raw(second,id)===await raw(page,id),'initial note synchronization');
  assert.equal(await raw(second,notes.bundle),await raw(page,notes.bundle));await open(second,id);await open(page,id);
  passed.push('a separate database receives the shared bundle and a working map via native sync');
  online=false;await edit(second,id,'Offline peer edit');assert.equal(JSON.parse(await raw(page,id)).document.root.text,'Sync baseline');
  online=true;await api(second,'POST','sync/now');await until(async()=>await raw(page,id)===await raw(second,id),'offline edit upload');
  await pane(page,id).locator('.mindmap-root-node').getByText('Offline peer edit',{exact:true}).waitFor();
  passed.push('an offline edit saves locally, then uploads intact and refreshes the other client');
  await edit(page,id,'Primary round trip');await api(second,'POST','sync/now');await until(async()=>await raw(page,id)===await raw(second,id),'primary edit download');
  await pane(second,id).locator('.mindmap-root-node').getByText('Primary round trip',{exact:true}).waitFor();
  passed.push('edits in the primary database sync back into the peer editor');
  online=false;await edit(second,id,'Acknowledged offline peer version');await edit(page,id,'Acknowledged primary version');
  online=true;await api(second,'POST','sync/now');await until(async()=>await raw(page,id)===await raw(second,id),'competing versions converge');
  const winner=JSON.parse(await raw(page,id)).document.root.text;assert.ok(['Acknowledged offline peer version','Acknowledged primary version'].includes(winner));
  const limitation='Native sync chooses one complete document when both independent databases already acknowledged competing edits; the add-on cannot guarantee retaining both.';
  const report={testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,id,passed,concurrentSync:{winner,limitation}};
  await mkdir(new URL('evidence/hardening/',testRoot),{recursive:true});await writeFile(new URL('evidence/hardening/sync.json',testRoot),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {
  online=true;await peer?.close();await mainContext.close();await browser.close();if(child?.exitCode===null)child.kill('SIGTERM');
  proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));
}
