import {readFile,writeFile} from 'node:fs/promises';
import {connect,testRoot} from './test-client.mjs';
import {checkNavigation} from './check-navigation.mjs';
const notes = JSON.parse(await readFile(new URL('spike-notes.json',testRoot),'utf8'));
const {browser,page} = await connect();
try {
  await page.reload(); await page.waitForFunction(()=>globalThis.glob?.appContext);
  const result = await checkNavigation(page,notes);
  await writeFile(new URL('evidence/navigation.json',testRoot),JSON.stringify({testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,...result},null,2));
  await page.screenshot({path:new URL('evidence/navigation.png',testRoot).pathname});
  console.log('Passed: three normal-note round trips; no blank frames in two delayed map switches; previews removed; stale bundle completion retains the current map and draft.');
} finally {await browser.close();}
