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
    const response=await fetch(`/api/notes/${id}/blob`,{headers:await glob.getHeaders()});
    return (await response.json()).content;
  },notes.bundle);
  assert.equal(createHash('sha256').update(installedBundle).digest('hex'),notes.bundleSha256);
  console.log('Desktop ready', await page.evaluate(()=>({version:glob.triliumVersion,electron:glob.isElectron,url:location.href})),userData);
  await page.locator('.fancytree-title').getByText('Willow Map A',{exact:true}).click();
  const pane=page.locator(`.willow-spike[data-note-id="${notes.A}"]:visible`).last();
  await pane.locator('.mindmap').waitFor();
  const transfer=pane.getByRole('button',{name:'Edit in this pane',exact:true});
  if(await transfer.isVisible()) await transfer.click();
  await pane.locator('.mindmap[aria-readonly="false"]').waitFor();
  await pane.locator('[data-node-id="root-A"] .mindmap-label').click();
  await page.keyboard.press('F2');
  await pane.locator('textarea').fill('Map A edited in isolated desktop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(async id=>{
    const response=await fetch(`/api/notes/${id}/blob`,{headers:await glob.getHeaders()});
    const blob=await response.json();
    return JSON.parse(blob.content).document.root.text==='Map A edited in isolated desktop';
  },notes.A);
  await pane.getByRole('status').getByText('Saved',{exact:true}).waitFor();
  await page.reload();
  await pane.locator('.mindmap-label').getByText('Map A edited in isolated desktop',{exact:true}).waitFor();
  await page.screenshot({path:fileURLToPath(new URL('evidence/spike/desktop.png',testRoot)),fullPage:true});
  const report={testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,userData,
    environment:await page.evaluate(()=>({version:glob.triliumVersion,electron:glob.isElectron,url:location.href})),
    passed:['isolated desktop data/profile','same shared bundle mounted on desktop','real label editing and save','reload persistence']};
  await writeFile(new URL('evidence/spike/desktop.json',testRoot),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {
  await browser?.close();
  if(processHandle.exitCode===null) processHandle.kill('SIGTERM');
}
