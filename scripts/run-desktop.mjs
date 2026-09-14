#!/usr/bin/env node
// Manual testing: persistent disposable data, separate from automated acceptance.
import { chromium } from 'playwright';
import { readFile, mkdir, access, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';

const repo = new URL('../', import.meta.url);
const root = new URL('.test/trilium/', repo);
const path = name => fileURLToPath(new URL(name, root));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node scripts/run-desktop.mjs [--no-build]\nBuild and open the isolated desktop app for manual testing.\nManual notes persist between runs. Quit the app or press Ctrl+C to stop.');
  process.exit(0);
}
if (args.some(arg => arg !== '--no-build')) throw new Error('Unknown option; use --help.');
const windows = process.platform === 'win32' && process.arch === 'x64';
if (!windows && !(process.platform === 'darwin' && process.arch === 'arm64')) throw new Error('This launcher supports the macOS arm64 and Windows x64 test installations.');
for (const port of [37843,39224]) {
  const occupied = await new Promise(resolve => {
    const socket = createConnection({host:'127.0.0.1',port});
    socket.on('connect',()=>{socket.destroy();resolve(true);});
    socket.on('error',()=>resolve(false));
  });
  if (occupied) throw new Error(`Port ${port} is occupied. Quit the manual test app before starting it again.`);
}
const executable = path(windows ? 'desktop/trilium.exe' : 'desktop/Trilium Notes.app/Contents/MacOS/trilium');
await access(executable);
if (!args.includes('--no-build')) {
  const build = spawnSync(windows ? 'pnpm.cmd' : 'pnpm',['build'],{cwd:fileURLToPath(repo),stdio:'inherit',shell:windows,windowsHide:true});
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const bundle = await readFile(new URL('dist/willow-spike.js',repo),'utf8');
const notes = JSON.parse(await readFile(path('spike-notes.json'),'utf8'));
await mkdir(path('manual-desktop-data'),{recursive:true});
await mkdir(path('manual-desktop-profile'),{recursive:true});
let initialized = true;
try { await access(path('manual-desktop-data/document.db')); } catch { initialized = false; }
if (!initialized) {
  const {default:Database} = await import('../.test/trilium/tools/node_modules/better-sqlite3/lib/index.js');
  const source = new Database(path('data/document.db'),{readonly:true});
  try { await source.backup(path('manual-desktop-data/document.db')); } finally { source.close(); }
  console.log('Created the manual test database from the isolated server.');
}
const log = openSync(path('manual-desktop.log'),'a');
console.log('Opening Trilium for manual testing...');
const child = spawn(executable,['--remote-debugging-port=39224','--remote-debugging-address=127.0.0.1'],{
  // This is the interactive app, not a background build helper. On Windows,
  // hiding the child can leave Electron running with no visible app window.
  cwd:fileURLToPath(root),stdio:['ignore',log,log],windowsHide:false,
  env:{...process.env,TRILIUM_DATA_DIR:path('manual-desktop-data'),TRILIUM_ELECTRON_DATA_DIR:path('manual-desktop-profile'),
    TRILIUM_HOST:'127.0.0.1',TRILIUM_PORT:'37843',TRILIUM_ENV:'production'},
});
closeSync(log);
const finished = new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
const stop = () => { if (child.exitCode === null) child.kill('SIGTERM'); };
process.once('SIGINT',stop); process.once('SIGTERM',stop);
await writeFile(path('manual-desktop.pid'),`${child.pid}\n`);
let browser;
try {
  for (let i=0; ; i++) {
    if (child.exitCode !== null) throw new Error('Trilium exited during startup; see .test/trilium/manual-desktop.log.');
    try { if ((await fetch('http://127.0.0.1:39224/json/version')).ok) break; } catch {}
    if (i === 150) throw new Error('Desktop did not become ready; see .test/trilium/manual-desktop.log.');
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser = await chromium.connectOverCDP('http://127.0.0.1:39224');
  let page;
  for (let i=0;i<150;i++) {
    page = browser.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app://app/'));
    if (page) break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if (!page) throw new Error('No desktop renderer appeared.');
  await page.waitForFunction(()=>globalThis.glob?.appContext);
  if (!initialized) {
    // Server-created databases persist empty desktop-only bindings. Restore the
    // stock zoom keys once when seeding this desktop fixture; retain later edits.
    await page.evaluate(async () => {
      const headers = await glob.getHeaders();
      const response = await fetch('/api/keyboard-actions', { headers });
      if (!response.ok) throw new Error('Could not read desktop keyboard defaults.');
      const actions = await response.json();
      for (const action of actions.filter(a => ['zoomIn','zoomOut','zoomReset'].includes(a.actionName))) {
        const name = `keyboardShortcuts${action.actionName[0].toUpperCase()}${action.actionName.slice(1)}`;
        const result = await fetch(`/api/options/${name}/${encodeURIComponent(JSON.stringify(action.defaultShortcuts))}`, {method:'PUT',headers});
        if (!result.ok) throw new Error(`Could not restore ${action.actionName}.`);
      }
    });
  }
  // Update only the code note; retain maps made during previous manual tests.
  await page.evaluate(async ({id,bundle})=>{
    if (location.protocol !== 'trilium-app:' || !glob.isElectron) throw new Error('Not the isolated desktop renderer.');
    const response = await fetch(`/api/notes/${id}/data`,{method:'PUT',
      headers:{...await glob.getHeaders(),'Content-Type':'application/json'},body:JSON.stringify({content:bundle})});
    if (!response.ok) throw new Error(`Could not update the shared editor: ${response.status}`);
  },{id:notes.bundle,bundle});
  await page.reload();
  await page.waitForFunction(()=>globalThis.glob?.appContext);
  await page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),notes.A);
  await browser.close(); browser = undefined; // Disconnect CDP; leave the app open.
  console.log('Ready for manual testing. Right-click a tree note → Insert child note / Insert note after → Willow Mind Map.');
  console.log('Data: .test/trilium/manual-desktop-data\nLog: .test/trilium/manual-desktop.log\nQuit Trilium or press Ctrl+C when finished.');
  await finished;
} finally {
  await browser?.close(); stop();
}
