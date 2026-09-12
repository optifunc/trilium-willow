import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connect, request, testRoot, baseUrl } from './test-client.mjs';

// Explicitly limited to this macOS test installation, never a user's Trilium.
const report = JSON.parse(await readFile(new URL('evidence/vertical-slice/browser.json', testRoot), 'utf8'));
const pid = Number((await readFile(new URL('server.pid', testRoot), 'utf8')).trim());
assert.ok(Number.isSafeInteger(pid) && pid > 1);
const cwd = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {encoding:'utf8'});
assert.ok(cwd.split('\n').includes(`n${fileURLToPath(new URL('server',testRoot))}`), 'PID is not the isolated server');
const listener = execFileSync('lsof', ['-tiTCP:37841', '-sTCP:LISTEN'], {encoding:'utf8'}).trim();
assert.equal(listener,String(pid),'Port 37841 belongs to another process');
let {browser,page}=await connect();
const expected = {};
for(const id of [report.id,report.recoveryId]) expected[id]=(await request(page,'GET',`notes/${id}/blob`)).content;
const remembered=await page.evaluate(id=>localStorage.getItem(`trilium-willow:view:v1:${id}`),report.id);
await browser.close();
process.kill(pid,'SIGTERM');
for(let i=0;i<100;i++) {
  let stopped=false;try {process.kill(pid,0);}catch {stopped=true;}
  if(stopped)break;
  if(i===99)throw new Error('Test server did not stop; refusing to start another process.');
  await new Promise(r=>setTimeout(r,100));
}
const log=openSync(new URL('server.log',testRoot),'a');
const child=spawn(fileURLToPath(new URL('start.sh',testRoot)),[],{cwd:fileURLToPath(testRoot),detached:true,stdio:['ignore',log,log]});
closeSync(log);child.unref();
await writeFile(new URL('server.pid',testRoot),`${child.pid}\n`);
for(let i=0;i<100;i++) {
  try {if((await fetch(baseUrl)).ok)break;}catch {}
  if(i===99)throw new Error('Restarted server did not become ready.');
  await new Promise(r=>setTimeout(r,100));
}
({browser,page}=await connect());
try {
  await page.reload();
  await page.waitForFunction(() => globalThis.glob?.appContext);
  for(const id of Object.keys(expected))assert.equal((await request(page,'GET',`notes/${id}/blob`)).content,expected[id]);
  await page.locator(`.willow-spike[data-note-id="${report.id}"] .mindmap`).waitFor();
  assert.equal(await page.evaluate(id=>localStorage.getItem(`trilium-willow:view:v1:${id}`),report.id),remembered);
  const result={testedAt:new Date().toISOString(),bundleSha256:report.bundleSha256,serverPid:child.pid,
    passed:['original and recovery documents survive server restart','browser remounts the editor with its local view state']};
  await writeFile(new URL('evidence/vertical-slice/restart.json',testRoot),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally {await browser.close();}
