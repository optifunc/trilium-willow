// Reproduce A2 captures in a fresh database. Requires the isolated Trilium server
// installation described in docs/test-trilium.md, Chrome, pnpm package and ffmpeg.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {openSync, closeSync} from 'node:fs';
import {readFile, writeFile, mkdir, mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {chromium} from 'playwright';
import {getActionDefinitions, formatShortcut} from '../mr/dist/mindmap.js';
import {waitSaved} from './test-ui.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const port=37851, url=`http://127.0.0.1:${port}`;
const serverDir=resolve(process.env.WILLOW_CAPTURE_SERVER || `${root}/.test/trilium/server`);
const examples=JSON.parse(await readFile(`${root}/examples/maps.json`,'utf8'));
const manifest=JSON.parse(await readFile(`${root}/dist/manifest.json`,'utf8'));
const out=`${root}/docs/media`, evidence=`${root}/docs/evidence/a2`;
await mkdir(out,{recursive:true});await mkdir(evidence,{recursive:true});
await mkdir(`${root}/.test/a2`,{recursive:true});
await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});
const run=await mkdtemp(`${root}/.test/a2/run-`);await mkdir(`${run}/data`);
const log=openSync(`${run}/server.log`,'a');
const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('TRILIUM_'))delete env[k];
const server=spawn(process.execPath,['main.cjs'],{cwd:serverDir,env:{...env,TRILIUM_DATA_DIR:`${run}/data`,TRILIUM_HOST:'127.0.0.1',TRILIUM_PORT:String(port),TRILIUM_ENV:'production'},stdio:['ignore',log,log]});closeSync(log);
let browser, page;
const report={testedAt:new Date().toISOString(),manifest,viewport:{width:1440,height:900},passed:[],errors:[]};
async function until(fn,label){for(let i=0;i<150;i++){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`Timed out: ${label}`);}
async function api(method,path,body){return page.evaluate(async({method,path,body,url})=>{
 if(location.origin!==url)throw new Error('Not the isolated A2 server');
 const r=await fetch(`/api/${path}`,{method,headers:{...await glob.getHeaders(),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await r.text();if(!r.ok)throw new Error(`${method} ${path}: ${r.status}`);return text?JSON.parse(text):undefined;
},{method,path,body,url});}
const raw=async id=>JSON.parse((await api('GET',`notes/${id}/blob`)).content);
const pane=()=>page.locator('.willow-spike:visible');
async function open(title){await page.locator('.fancytree-title').getByText(title,{exact:true}).click();}
const definitions=getActionDefinitions();
let mac=true;
function shortcut(id,direction){const binding={...definitions.find(a=>a.id===id).bindings[0]};if(direction)binding.key=`Arrow${direction}`;return binding;}
async function key(id,direction){const b=shortcut(id,direction);const keys=[b.primary?(mac?'Meta':'Control'):null,b.control?'Control':null,b.shift?'Shift':null,b.code|| (b.key==='Space'?'Space':b.key)].filter(Boolean);await page.keyboard.press(keys.join('+'));}
async function fit(){await pane().locator('.mindmap').focus();await key('fit');await page.waitForTimeout(350);}
async function setup(){
 await until(async()=>(await fetch(`${url}/api/setup/status`)).ok,'server startup');
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1});page=await context.newPage();
 await page.goto(url);await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByText('New knowledge base',{exact:true}).click();await page.getByText('Empty',{exact:true}).click();
 const password=`A2-${crypto.randomUUID()}`;
 await page.locator('input[type=password]').first().fill(password);await page.locator('input[type=password]').nth(1).fill(password);
 await page.getByRole('button',{name:'Set password',exact:true}).click();
 await page.getByRole('button',{name:'Log in',exact:true}).waitFor();await page.locator('input[type=password]').fill(password);await page.getByRole('button',{name:'Log in',exact:true}).click();
 await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
 report.environment=await page.evaluate(()=>({trilium:glob.triliumVersion,userAgent:navigator.userAgent,platform:navigator.platform}));mac=/Mac/.test(report.environment.platform);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.locator('.fancytree-title').getByText('root',{exact:true}).click({button:'right'});
 await page.getByText('Import into note',{exact:true}).click();
 await page.getByText('Options',{exact:true}).click();
 await page.locator('.file-drop-zone-input').setInputFiles(`${root}/dist/trilium-willow-${manifest.version}.zip`);
 await page.waitForTimeout(300);assert.equal(await page.getByLabel('Safe import',{exact:true}).isChecked(),true);
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.locator('.fancytree-title').getByText('Willow Mind Map add-on',{exact:true}).waitFor();
 const children=await page.evaluate(async()=> (await glob.appContext.tabManager.getActiveContext().note.getChildNotes()).map(n=>({id:n.noteId,title:n.title})));
 const ids=Object.fromEntries(children.map(n=>[n.title,n.id]));
 for(const title of ['Willow Mind Map',...examples.map(e=>e.title)]){
  await open(title);await page.getByRole('button',{name:/Enable render note/}).click();
  if(title==='Willow Mind Map')await page.locator('.willow-notice').waitFor();
  else {await pane().locator('[data-ready=true]').waitFor();assert.deepEqual(await raw(ids[title]),examples.find(e=>e.title===title).document);}
 }
 report.passed.push('Fresh native Safe import and activation preserve all three canonical example documents');
 return {context,ids};
}
try {
 const {context,ids}=await setup();
 // UI layout is shared by Willow and native Mind Map comparison captures.
 await page.getByRole('button',{name:'Hide right pane',exact:true}).click();
 await page.getByText('Import finished successfully.',{exact:true}).waitFor({state:'hidden'});
 for(const e of examples){await open(e.title);await pane().locator('[data-ready=true]').waitFor();await fit();await page.screenshot({path:`${out}/${e.key}.png`});}
 const native=await api('POST','notes/root/children?target=into',{title:'Workshop ideas — native',type:'mindMap',mime:'application/json',content:''});
 await page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),native.note.noteId);
 await page.locator('me-root me-tpc:visible').waitFor();
 await page.locator('me-root me-tpc:visible').click();await page.keyboard.press('Tab');await page.locator('#input-box:visible').fill('Temporary');await page.keyboard.press('Enter');
 await until(async()=>!!(await api('GET',`notes/${native.note.noteId}/blob`)).content,'native save');
 const nativeData=await raw(native.note.noteId);
 const workshop=examples.find(e=>e.key==='workshop').document.document.root;
 function convert(n){return {id:n.id,topic:n.text,children:n.children.map(convert),expanded:!n.collapsed,...(n.side?{direction:n.side==='left'?0:1}:{})};}
 nativeData.nodeData=convert(workshop);nativeData.direction=2;
 await api('PUT',`notes/${native.note.noteId}/data`,{content:JSON.stringify(nativeData)});
 await page.reload();await page.locator('me-root me-tpc:visible').waitFor();
 assert.deepEqual((await raw(native.note.noteId)).nodeData,convert(workshop));
 const count=n=>1+n.children.reduce((sum,c)=>sum+count(c),0);
 await until(async()=>await page.locator('me-tpc:visible').count()===count(workshop),'native hierarchy');
 // Fit via native controls, without changing native fonts, spacing or theme.
 await page.getByRole('button',{name:'Center the map',exact:true}).click();
 for(let i=0;i<25;i++){
  const fits=await page.evaluate(()=>{
   const box=document.querySelector('.note-detail')?.getBoundingClientRect();
   return box&&[...document.querySelectorAll('me-tpc')].filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=box.left+12&&r.right<=box.right-12&&r.top>=box.top+30&&r.bottom<=box.bottom-30;});
  });
  if(fits)break;
  await page.getByRole('button',{name:'Zoom out',exact:true}).click();await page.getByRole('button',{name:'Center the map',exact:true}).click();await page.waitForTimeout(120);
  if(i===24)throw new Error('Native hierarchy did not fit');
 }
 await page.keyboard.press('Escape');
 await page.mouse.move(220,80);await page.waitForTimeout(400);
 const nativeBox=await page.locator('.note-detail:visible').boundingBox();
 await page.locator('.note-detail:visible').screenshot({path:`${out}/comparison-native.png`});
 await open('Workshop ideas');await pane().locator('[data-ready=true]').waitFor();await fit();
 const willowBox=await page.locator('.note-detail:visible').boundingBox();
 assert.equal(willowBox.width,nativeBox.width);assert.equal(willowBox.height,nativeBox.height);
 await page.locator('.note-detail:visible').screenshot({path:`${out}/comparison-willow.png`});
 report.comparison={nodes:count(workshop),willowBox,nativeBox,nativeDirection:nativeData.direction,nativeTheme:nativeData.theme.name,nativeCompact:nativeData.compact};
 report.passed.push('Same complete workshop text/hierarchy/order in native Mind Map and Willow at equal pane dimensions; native keyboard creation exercised');
 // Reload every example and compare stored content before recording any edits.
 for(const e of examples){await open(e.title);await page.reload();await pane().locator('[data-ready=true]').waitFor();assert.deepEqual(await raw(ids[e.title]),e.document);}
 report.passed.push('All packaged examples survive reload with canonical content, folded details and checkbox state');
 const state=await context.storageState();
 await context.close();
 const videoContext=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,storageState:state,recordVideo:{dir:`${run}/video`,size:report.viewport}});
 const videoStart=Date.now();page=await videoContext.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url);await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
 await open('Weekend packing');await pane().locator('[data-ready=true]').waitFor();await fit();
 const pause=ms=>page.waitForTimeout(ms);
 async function caption(title,keys=''){
  await page.evaluate(({title,keys})=>{
   let el=document.getElementById('willow-demo-caption');if(!el){el=document.createElement('div');el.id='willow-demo-caption';el.style.cssText='position:fixed;left:440px;right:28px;bottom:58px;z-index:99999;background:#153e3b;color:white;padding:14px 20px;border-radius:10px;font:16px system-ui;display:flex;justify-content:space-between;gap:20px;pointer-events:none;box-shadow:0 2px 10px #0002';document.body.append(el);}
   el.replaceChildren();const label=document.createElement('span');label.textContent=title;const key=document.createElement('strong');key.textContent=keys;el.append(label,key);
  },{title,keys});
 }
 const steps=[];
 async function step(title,id,action,direction){
  const binding=id?formatShortcut(shortcut(id,direction),mac):'Click';
  steps.push({atSeconds:(Date.now()-videoStart)/1000,title,keys:binding});await caption(title,binding);await pause(700);await action();await pause(1800);
 }
 const label=text=>pane().locator('.mindmap-label').getByText(text,{exact:true});
 const enter=async text=>{
  await pane().locator('textarea').pressSequentially(text,{delay:60});
  await page.evaluate(key=>{document.querySelector('#willow-demo-caption strong').textContent+=` → type → ${key}`;},formatShortcut(shortcut('finishEditing'),mac));
  await key('finishEditing');await waitSaved(pane());
 };
 report.videoTrim={start:(Date.now()-videoStart)/1000};
 await caption('A weekend list with room to branch','Willow · Trilium');await pause(2200);
 await step('Add an idea under Day bag','insertChild',async()=>{await label('Day bag').click();await key('insertChild');await enter('Rain cover');});
 await step('Nest a useful detail','insertChild',async()=>{await key('insertChild');await enter('For camera');});
 await step('Move the whole branch up','moveSelection',async()=>{await label('Rain cover').click();await key('moveSelection','Up');},'Up');
 await step('Turn the idea into a checklist item','toggleCheckbox',async()=>{await key('toggleCheckbox');});
 await step('Check it off','toggleChecked',async()=>{await key('toggleChecked');await waitSaved(pane());});
 await step('Fold Clothes to keep the essentials in view','toggleCollapse',async()=>{await label('Clothes').click();await key('toggleCollapse');await waitSaved(pane());});
 const expected=await raw(ids['Weekend packing']);
 await step('Leave the map and open a reference',null,async()=>{await open('Home reference');await pane().locator('[data-ready=true]').waitFor();await fit();});
 await step('Expand the details you need','toggleCollapse',async()=>{await label('Washer').click();await key('toggleCollapse');await fit();});
 await step('Return to the saved packing list',null,async()=>{await open('Weekend packing');await pane().locator('[data-ready=true]').waitFor();await fit();});
 assert.deepEqual(await raw(ids['Weekend packing']),expected);
 const rootNode=expected.document.root;
 const day=rootNode.children.find(n=>n.text==='Day bag');const rain=day.children.find(n=>n.text==='Rain cover');
 assert.equal(rain.checked,true);assert.equal(rain.children[0].text,'For camera');assert.ok(day.children.indexOf(rain)<day.children.findIndex(n=>n.text==='Book'));assert.equal(rootNode.children.find(n=>n.text==='Clothes').collapsed,true);
 await caption('Your structure and checks are saved','Leave · return · keep going');await pause(2300);
 report.videoTrim.duration=(Date.now()-videoStart)/1000-report.videoTrim.start;
 await page.evaluate(()=>document.getElementById('willow-demo-caption')?.remove());
 await page.screenshot({path:`${out}/workflow-end.png`});
 const video=page.video();await videoContext.close();const videoPath=await video.path();
 report.demoSteps=steps;report.passed.push('Recorded real keyboard creation/nesting/reordering/folding/checking and tree navigation; saved document retains the demonstrated structure and checks');
 const args=['-y','-ss',String(report.videoTrim.start),'-i',videoPath,'-t',String(report.videoTrim.duration),'-an','-vf','scale=1200:-2','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/workflow.mp4`];
 let converted=spawnSync('ffmpeg',args,{encoding:'utf8'});if(converted.status!==0)throw new Error(converted.stderr);
 converted=spawnSync('ffmpeg',['-y','-i',`${out}/workflow.mp4`,'-filter_complex','fps=8,scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',`${out}/workflow.gif`],{encoding:'utf8'});if(converted.status!==0)throw new Error(converted.stderr);
 assert.deepEqual(report.errors,[]);
 await writeFile(`${evidence}/capture.json`,JSON.stringify(report,null,2)+'\n');
 console.log('A2 capture and checks passed',JSON.stringify({run,comparison:report.comparison,video:report.videoTrim}));
} catch(error){report.error=String(error);await page?.screenshot({path:`${run}/failure.png`}).catch(()=>{});await writeFile(`${run}/failure.json`,JSON.stringify(report,null,2));throw error;}
finally {await browser?.close();server.kill('SIGTERM');}
