// Run against the isolated browser, or the running isolated desktop with --desktop.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { connect, testRoot } from './test-client.mjs';
import { createFromMenu, nativePane, waitSaved } from './test-ui.mjs';
const desktop = process.argv.includes('--desktop');
const notes = JSON.parse(await readFile(new URL('spike-notes.json', testRoot)));
const browser = desktop ? await chromium.connectOverCDP('http://127.0.0.1:39223') : (await connect()).browser;
const page = browser.contexts()[0].pages().find(p => p.url().startsWith(desktop ? 'trilium-app:' : notes.baseUrl));
const bundle=await readFile(new URL('../dist/willow-spike.js',import.meta.url),'utf8');
const passed = [];
const pass = text => { passed.push(text); console.log(text); };
async function api(method, path, body) {
  return page.evaluate(async ({method,path,body}) => {
    if (!['http://127.0.0.1:37841','trilium-app://app'].includes(location.origin)) throw Error('Not isolated fixture');
    const r = await fetch(`/api/${path}`, {method,cache:'no-store',headers:{...await glob.getHeaders(),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if (!r.ok) throw Error(await r.text()); return r.status===204?undefined:r.json();
  },{method,path,body});
}
try {
  page.on('dialog',d=>d.accept().catch(()=>{}));
  await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  await api('PUT',`notes/${notes.bundle}/data`,{content:bundle});
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  const title=`Title sync ${Date.now()}`;
  const seed={format:'trilium-willow-mindmap',version:1,document:{root:{id:'title-root',text:'Old root',children:[{id:'title-child',text:'Child',side:'right',children:[]}]}}};
  const result=await api('POST',`notes/${notes.folder}/children?target=into`,{title,type:'render',mime:'application/json',content:JSON.stringify(seed),isProtected:false});
  const id=result.note.noteId;
  await api('PUT',`notes/${id}/set-attribute`,{type:'relation',name:'renderNote',value:notes.bundle});
  await api('PUT',`notes/${id}/set-attribute`,{type:'label',name:'willowMindMap',value:''});
  await page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),id);
  const pane=page.locator(`.willow-spike[data-note-id="${id}"]:visible`).last();
  const label=pane.locator('.mindmap-root-node .mindmap-label');await label.getByText(title,{exact:true}).waitFor();await waitSaved(pane);
  const stored=async()=>JSON.parse((await api('GET',`notes/${id}/blob`)).content).document;
  assert.deepEqual((await stored()).root.children,seed.document.root.children);
  pass('First opening aligns root to title and preserves children');
  let renamed=title+' renamed';const input=nativePane(pane).locator('input.note-title:visible');
  await input.click();await input.press('Meta+A');await page.keyboard.type(renamed,{delay:25});
  assert.equal(await input.inputValue(),renamed);assert.equal(await pane.locator('textarea').count(),0);
  await pane.locator('.mindmap').focus();await label.getByText(renamed,{exact:true}).waitFor();await waitSaved(pane);
  assert.equal((await stored()).root.text,renamed);pass('Native title typing retains focus and updates root after save');
  renamed+=' before navigation';await input.fill(renamed);await page.keyboard.press('Meta+[');
  await page.waitForFunction(async ({id,text})=>{
    const r=await fetch(`/api/notes/${id}/blob`,{cache:'no-store',headers:await glob.getHeaders()});
    return JSON.parse((await r.json()).content).document.root.text===text;
  },{id,text:renamed});
  await page.waitForFunction(id=>glob.appContext.tabManager.getActiveContext().note?.noteId!==id,id);
  await page.reload();await page.waitForFunction(()=>globalThis.glob?.appContext?.tabManager?.getActiveContext());
  await page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),id);
  await label.getByText(renamed,{exact:true}).waitFor();await waitSaved(pane);
  pass('Keyboard navigation commits a focused native title and its root');
  async function edit(text) {await label.dblclick();await pane.locator('textarea').fill(text);await page.keyboard.press('Enter');await waitSaved(pane);}
  const edited=title+' root edit';await edit(edited);assert.equal((await api('GET',`notes/${id}`)).title,edited);
  await pane.locator('.mindmap').focus();await page.keyboard.press('Meta+z');await label.getByText(renamed,{exact:true}).waitFor();await waitSaved(pane);
  assert.equal((await api('GET',`notes/${id}`)).title,renamed);pass('Root edit and undo update native title');
  await page.reload();await label.getByText(renamed,{exact:true}).waitFor();await waitSaved(pane);pass('Root and title survive renderer reload');
  // A failed second request must leave a retryable draft after content has saved.
  await page.evaluate(id=>{
    const original=window.fetch;globalThis.restoreTitleFetch=()=>{window.fetch=original;};
    window.fetch=function(input,options){
      if(String(input?.url??input).endsWith(`/notes/${id}/title`)&&options?.method==='PUT') return Promise.reject(Error('Injected title write failure'));
      return original.call(this,input,options);
    };
  },id);
  await label.dblclick();await pane.locator('textarea').fill('Retry root');await page.keyboard.press('Enter');
  await pane.getByRole('button',{name:'Retry save',exact:true}).waitFor();assert.equal((await stored()).root.text,'Retry root');
  await page.evaluate(()=>globalThis.restoreTitleFetch());await pane.getByRole('button',{name:'Retry save',exact:true}).click();await waitSaved(pane);
  assert.equal((await api('GET',`notes/${id}`)).title,'Retry root');pass('Failed title write retries after successful content save');
  await page.evaluate(id=>glob.appContext.tabManager.getActiveContext().setNote(id),notes.folder);
  const created=await createFromMenu(page,'Willow integration spike','child',title+' menu');
  pass('Native template creation synchronizes the typed title without starting root editing');
  const directory=new URL('evidence/title/',testRoot);await mkdir(directory,{recursive:true});
  await writeFile(new URL(`${desktop?'desktop':'browser'}.json`,directory),JSON.stringify({testedAt:new Date().toISOString(),desktop,bundleSha256:createHash('sha256').update(bundle).digest('hex'),environment:await page.evaluate(()=>({version:glob.triliumVersion,platform:navigator.platform,electron:glob.isElectron})),id,created:created.id,passed},null,2)+'\n');
} finally {await page.evaluate(()=>globalThis.restoreTitleFetch?.()).catch(()=>{});await browser.close();}
