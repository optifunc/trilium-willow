#!/usr/bin/env node
// Start an official desktop app with a fresh, disposable database and profile.
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  app: { type: 'string' },
  help: { type: 'boolean' },
} });
if (values.help) {
  console.log('Usage: pnpm test:setup --app /path/to/Trilium/executable\nCreates a fresh database/profile under .test/clean-trilium/run-*.\nPorts: HTTP 37850, local browser debugging 39228. Quit or Ctrl+C to stop.');
  process.exit(0);
}
if (!values.app) throw new Error('Supply --app with the official desktop executable; see docs/testing.md.');
const app = resolve(values.app);
await access(app);
// Refuse an occupied test port before creating files or launching an app.
for (const port of [37850, 39228]) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Port ${port} is occupied. Stop the previous test instance first.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
const root = fileURLToPath(new URL('../.test/clean-trilium/', import.meta.url));
await mkdir(root, { recursive: true });
const run = await mkdtemp(join(root, 'run-'));
const data = join(run, 'data'), profile = join(run, 'profile');
await mkdir(data);
await mkdir(profile);
const log = openSync(join(run, 'desktop.log'), 'a');
const env = { ...process.env };
// Inherited Trilium settings must not redirect this disposable instance.
for (const key of Object.keys(env)) if (key.startsWith('TRILIUM_')) delete env[key];
const child = spawn(app, ['--remote-debugging-port=39228', '--remote-debugging-address=127.0.0.1'], {
  cwd: run, stdio: ['ignore', log, log],
  env: { ...env, TRILIUM_DATA_DIR: data, TRILIUM_ELECTRON_DATA_DIR: profile,
    TRILIUM_HOST: '127.0.0.1', TRILIUM_PORT: '37850', TRILIUM_ENV: 'production' },
});
closeSync(log);
const stop = () => { if (child.exitCode === null) child.kill('SIGTERM'); };
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
const finished = new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve({ code, signal }));
});
// Register the rejection handler before any asynchronous filesystem operation.
finished.catch(() => {});
try {
  await writeFile(join(run, 'run.json'), JSON.stringify({ app, pid: child.pid, data, profile,
    startedAt: new Date().toISOString(), httpPort: 37850, debugPort: 39228 }, null, 2) + '\n');
  console.log(`Fresh Trilium test instance: ${run}\nComplete the native first-run setup with a new knowledge base.\nImport dist/trilium-willow-<version>.zip using native Import with Safe import enabled.\nLog: ${join(run, 'desktop.log')}\nQuit the app (Cmd+Q on macOS) or Ctrl+C to stop. Test data is retained for inspection.`);
  const result = await finished;
  if (result.code) process.exitCode = result.code;
} finally {
  stop();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
