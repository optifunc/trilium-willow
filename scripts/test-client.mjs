import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

export const testRoot = new URL('../.test/trilium/', import.meta.url);
export const baseUrl = 'http://127.0.0.1:37841';

export async function connect() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:39222');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().startsWith(baseUrl)) ?? await context.newPage();
  if (!page.url().startsWith(baseUrl)) await page.goto(baseUrl);
  const credentials = JSON.parse(await readFile(new URL('credentials.json', testRoot), 'utf8'));
  if (credentials.url !== baseUrl) throw new Error('Refusing to deploy outside the isolated test server.');
  await page.waitForFunction(() => document.querySelector('input[type=password]') || globalThis.glob?.appContext);
  if (await page.locator('input[type=password]').isVisible()) {
    await page.locator('input[type=password]').fill(credentials.password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForFunction(() => globalThis.glob?.appContext);
  }
  return { browser, context, page };
}

export async function request(page, method, path, body) {
  return page.evaluate(async ({ method, path, body, baseUrl }) => {
    if (location.origin !== baseUrl) throw new Error('Not connected to the isolated test instance.');
    const response = await fetch(`/api/${path}`, {
      method, headers: { ...await glob.getHeaders(), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0,500)}`);
    return text ? JSON.parse(text) : undefined;
  }, { method, path, body, baseUrl });
}
