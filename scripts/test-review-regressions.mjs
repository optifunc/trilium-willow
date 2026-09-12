import {readFile,writeFile} from 'node:fs/promises';
import {connect,testRoot} from './test-client.mjs';
import {checkReviewRegressions} from './check-review-regressions.mjs';
const {browser,page}=await connect();
try {
  const notes=JSON.parse(await readFile(new URL('spike-notes.json',testRoot),'utf8'));
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  const result={testedAt:new Date().toISOString(),bundleSha256:notes.bundleSha256,...await checkReviewRegressions(page,notes)};
  await writeFile(new URL('evidence/review-regressions.json',testRoot),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
