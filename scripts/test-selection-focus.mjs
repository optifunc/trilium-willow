import {readFile,writeFile} from 'node:fs/promises';
import {connect,testRoot} from './test-client.mjs';
import {checkSelectionFocus} from './check-selection-focus.mjs';
const notes=JSON.parse(await readFile(new URL('spike-notes.json',testRoot),'utf8'));
const {browser,page}=await connect();
try {
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  const result=await checkSelectionFocus(page,notes);
  const report={testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,...result};
  await writeFile(new URL('evidence/selection-focus.json',testRoot),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
