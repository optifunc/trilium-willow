import { checkNavigation } from './check-navigation.mjs';
import { createFromMenu, waitSaved, measureSwitch } from './test-ui.mjs';
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import Database from '../.test/trilium/tools/node_modules/better-sqlite3/lib/index.js';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { testRoot } from './test-client.mjs';

const notes = JSON.parse(await readFile(new URL('spike-notes.json', testRoot), 'utf8'));
// Refresh only the disposable desktop fixture from a consistent read-only backup.
let desktopRunning=false;
try { desktopRunning=(await fetch('http://127.0.0.1:39223/json/version')).ok; } catch {}
if(desktopRunning) throw new Error('Close the isolated desktop test before replacing its fixture.');
const source=new Database(fileURLToPath(new URL('data/document.db',testRoot)),{readonly:true});
try { await source.backup(fileURLToPath(new URL('desktop-data/document.db',testRoot))); }
finally { source.close(); }
// The packaged build starts normally but Playwright's Electron main-process
// handshake times out. Attach to its real renderer through CDP instead.
const log=openSync(new URL('desktop.log',testRoot),'a');
const processHandle=spawn(fileURLToPath(new URL('desktop/Trilium Notes.app/Contents/MacOS/trilium', testRoot)),
 ['--remote-debugging-port=39223','--remote-debugging-address=127.0.0.1'], {
  cwd: fileURLToPath(testRoot),
  env: { ...process.env,
    TRILIUM_DATA_DIR: fileURLToPath(new URL('desktop-data', testRoot)),
    TRILIUM_ELECTRON_DATA_DIR: fileURLToPath(new URL('desktop-profile', testRoot)),
    TRILIUM_PORT: '37842', TRILIUM_HOST: '127.0.0.1', TRILIUM_ENV: 'production',
  },
  stdio:['ignore',log,log],
});
closeSync(log);
await writeFile(new URL('desktop.pid',testRoot),String(processHandle.pid)+'\n');
let browser;
try {
  for(let i=0;i<100;i++) {
    if(processHandle.exitCode!==null) throw new Error(`Desktop exited: ${processHandle.exitCode}`);
    try { if((await fetch('http://127.0.0.1:39223/json/version')).ok) break; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.connectOverCDP('http://127.0.0.1:39223');
  const context=browser.contexts()[0];
  let page;
  for(let i=0;i<100;i++) {
    page=context.pages().find(p=>p.url().startsWith('trilium-app:'));
    if(page) break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!page) throw new Error('No native Trilium renderer found');
  // Electron can resolve its native unload dialog before CDP receives it.
  // Handle that race explicitly instead of Playwright's unhandled auto-dismiss.
  page.on('dialog',dialog=>dialog.accept().catch(()=>{}));
  const userData=fileURLToPath(new URL('desktop-profile',testRoot));
  await page.waitForFunction(() => globalThis.glob?.appContext, undefined, {timeout:30000});
  const installedBundle=await page.evaluate(async id=>{
    const response=await fetch(`/api/notes/${id}/blob`,{cache:'no-store',headers:await glob.getHeaders()});
    return (await response.json()).content;
  },notes.bundle);
  assert.equal(createHash('sha256').update(installedBundle).digest('hex'),notes.bundleSha256);
  console.log('Desktop ready', await page.evaluate(()=>({version:glob.triliumVersion,electron:glob.isElectron,url:location.href})),userData);
  await page.locator('.fancytree-title').getByText('Willow Map A',{exact:true}).click();
  const pane=page.locator(`.willow-spike[data-note-id="${notes.A}"]:visible`).last();
  await pane.locator('.mindmap').waitFor();
  const transfer=pane.getByRole('button',{name:'Edit here',exact:true});
  if(await transfer.isVisible()) await transfer.click();
  await pane.locator('.mindmap[aria-readonly="false"]').waitFor();
  await pane.locator('[data-node-id="root-A"] .mindmap-label').click();
  await page.keyboard.press('F2');
  await pane.locator('textarea').fill('Map A edited in isolated desktop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(async id=>{
    const response=await fetch(`/api/notes/${id}/blob`,{cache:'no-store',headers:await glob.getHeaders()});
    const blob=await response.json();
    return JSON.parse(blob.content).document.root.text==='Map A edited in isolated desktop';
  },notes.A);
  await waitSaved(pane);
  await page.reload();
  await pane.locator('.mindmap-label').getByText('Map A edited in isolated desktop',{exact:true}).waitFor();
  const title=`Desktop acceptance ${Date.now()}`;
  const {id}=await createFromMenu(page,'Willow Map A','after',title);
  const createdPane=page.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
  await createdPane.locator('.mindmap-root-node .mindmap-label').getByText('Mind map',{exact:true}).waitFor();
  async function view() {
    return page.evaluate(id=>{
      const v=[...globalThis[Symbol.for('trilium-willow.spike')].active.values()].find(v=>v.noteId===id&&v.host.isConnected&&v.host.clientWidth>0);
      const el=v.host.querySelector('.mindmap'), p=v.editor.getViewport();
      return {zoom:p.zoom,centerX:(el.clientWidth/2-p.x)/p.zoom,centerY:(el.clientHeight/2-p.y)/p.zoom};
    },id);
  }
  function sameView(a,b) {for(const key of ['zoom','centerX','centerY'])assert.ok(Math.abs(a[key]-b[key])<.02,JSON.stringify({a,b}));}
  sameView(await view(),{zoom:1,centerX:0,centerY:0});
  await createdPane.locator('.mindmap').click({position:{x:20,y:20}});
  await page.keyboard.press('Meta+=');
  await createdPane.locator('.mindmap').hover({position:{x:20,y:20}});await page.mouse.wheel(120,80);
  await page.waitForFunction(id=>localStorage.getItem(`trilium-willow:view:v1:${id}`),id);
  const remembered=await view();assert.ok(remembered.zoom>1);
  await page.locator('.fancytree-title').getByText('Willow Map B',{exact:true}).click();
  await page.locator(`.willow-spike[data-note-id="${notes.B}"] .willow-spike-host[data-ready="true"]`).waitFor();
  const switching=await measureSwitch(page,title,id);
  assert.equal(switching.mounts,1);
  assert.ok(switching.frames.length>1);
  for(const frame of switching.frames)assert.deepEqual(frame,switching.frames[0]);
  await createdPane.locator('.mindmap').waitFor();sameView(await view(),remembered);
  await page.reload();await createdPane.locator('.mindmap').waitFor();sameView(await view(),remembered);
  const navigation=await checkNavigation(page,notes);
  await page.screenshot({path:fileURLToPath(new URL('evidence/spike/desktop.png',testRoot)),fullPage:true});
  const report={testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,userData,
    environment:await page.evaluate(()=>({version:glob.triliumVersion,electron:glob.isElectron,url:location.href})),
    createdNoteId:id,switching,navigation,
    passed:['isolated desktop data/profile','same shared bundle mounted on desktop','real label editing and save','reload persistence',
      'native template menu keeps title and root independent and centres at 100%','desktop pan/zoom survives note switching and renderer reload']};
  await writeFile(new URL('evidence/spike/desktop.json',testRoot),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {
  await browser?.close();
  if(processHandle.exitCode===null) processHandle.kill('SIGTERM');
}
