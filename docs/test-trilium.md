# Local Trilium test server

For the current Windows setup, zoom investigation, and run commands, see
[Windows verification](test-windows.md). The original macOS setup below is
retained as historical platform-specific documentation.

For package installation checks, run `pnpm package` then `pnpm test:distribution`.
The latter creates independent empty server and desktop databases under
`.test/trilium/distribution/run-*`, using ports 37848/37849 and desktop CDP 39227.
It imports the same ZIP through each client's native importer, activates the
template/example with the native control, and tests creation, code replacement,
removal/source recovery, and reinstall. The desktop database is initialized empty
by the stock server before native launch; no installed Willow notes are copied.
The primary test database is untouched. Logs and source-view screenshots stay in
the run directory; results are in `.test/trilium/evidence/distribution.json`.
Processes stop at the end. SIGTERM is cleanup, not lifecycle evidence; dedicated
native window-close evidence remains in `pnpm test:desktop:lifecycle`.

Provisioned and verified on 2026-09-12. This completes the server/browser setup
checkpoint. The subsequent [mind-map adapter](progress.md), including creation,
recovery, and local view persistence, is installed in this test server.

## Access and isolation

- URL: http://127.0.0.1:37841/
- Version: Trilium v0.105.0, build `a0908a6e1e`, database 240, sync 39.
- Installation: `../.test/trilium/server/`
- Database and configuration: `../.test/trilium/data/`
- Test-only password: [credentials.json](../.test/trilium/credentials.json).
  The login form only requires the password, no username.
- Log: [server.log](../.test/trilium/server.log).
- Current server PID: [server.pid](../.test/trilium/server.pid).
- All of `.test/` is ignored by Git, including credentials, browser profile,
  downloads, dependencies, logs, screenshots, and database.

The server listens on `127.0.0.1` only. It uses a new empty knowledge base and is
not configured to initiate sync with another instance. The optional hardening test
connects a disposable peer to it over loopback, as described below. The existing desktop installation
and personal database were not used or modified.

## Installation details

Downloaded the official
[v0.105.0 Linux ARM64 server archive](https://github.com/TriliumNext/Trilium/releases/tag/v0.105.0)
to `.test/trilium/downloads/`. Its SHA-256 matched the release asset metadata:

```text
db6e3598d83858280911b59b7d211165f2a0da0987b80ff4461251797bce5e89
```

Trilium does not publish a macOS server archive. This test setup runs the released
`main.cjs` and web assets with the existing macOS Node v24.2.0 executable at
`/opt/homebrew/bin/node`, rather than the archive's Linux Node executable. The
matching `better-sqlite3@13.0.3` macOS ARM64 prebuild was installed from npm under
`.test/trilium/tools/` and copied into the server module's `prebuilds/` directory.
The in-memory SQLite check and actual Trilium database initialization both passed.
No application JavaScript was changed. This is a local platform adaptation of
the released server, not an official macOS server distribution.

Playwright v1.58.2 is installed under `.test/trilium/tools/`, with its npm cache
also under the test directory. The controlled browser is installed Chrome
152.0.7977.83, launched headless using only `.test/trilium/browser-profile/` and
loopback debugging port 39222. Its PID and log are in `browser.pid` and
`browser.log` respectively. No personal Chrome profile was opened.

## Running

The server was left running after verification. To start it when stopped, from
the repository root:

```sh
.test/trilium/start.sh
```

The launcher fixes the data directory, host, port, and working directory. In the
foreground, Ctrl+C stops it. Do not start a second copy against the running test
database. The detached process created during setup records its PID in
`.test/trilium/server.pid`; confirm its identity before stopping it.

The current isolated Chrome session can be controlled through Playwright's
`chromium.connectOverCDP('http://127.0.0.1:39222')`. With that session on the test
note, the editing/readback smoke test can be rerun with:

```sh
node .test/trilium/verify-browser.mjs
```

This script deliberately rewrites the smoke-test note's content. Setup and note
creation were performed interactively through Playwright before this script;
the script is not a provisioning tool.

## Verification

Passed using actual pointer/keyboard/form input:

- Language selection, empty knowledge-base creation, password setup, and login.
- Creation of a child text note through the tree context menu.
- Title editing, rich-text entry, and separate keyboard editing.
- Successful title/content save responses, followed by reload and readback.
- Login and readback from a separate, initially unauthenticated browser context.
- Graceful server restart, followed by browser verification of the same saved
  title and all three content paragraphs.
- No browser page errors during the final editing smoke test.
- Final screenshot visually inspected; loopback listener and Git ignore verified.

Evidence: [JSON report](../.test/trilium/evidence/browser-smoke.json) and
[screenshot after restart](../.test/trilium/evidence/07-after-server-restart.png).

The subsequent integration spike mounted `mr` in a shared Render Note bundle and
verified map persistence and lifecycle in the browser, plus desktop mount/edit/
reload in a separate test app. See the [progress log](progress.md) for the tested
scope, subsequent hardening results, and remaining limitations.

## Persistence and host hardening

Run `pnpm test:hardening` after deploying the bundle. The test creates disposable
notes and uses separate browser contexts. It tests delayed/offline saves, two
clients, read-only changes, revision restoration, deletion/undelete, protected
sessions, theme contrast, clipboard, and native archive import/export. Theme
changes are restored; protected-session logout intentionally reloads test clients.

`node scripts/test-sync.mjs` runs the real sync engine in a second server process
with `.test/trilium/sync-data` on port 37844. A proxy bound to 127.0.0.1:37845
forwards only to the primary test server; temporarily refusing requests simulates
an offline link. Both processes are stopped after the test. The peer database
persists for future runs; test notes are newly created on each run.

Evidence is in `.test/trilium/evidence/hardening/`. Synchronization of competing
already-saved versions follows Trilium's last-write-wins behavior. A map-only
archive preserves the JSON but needs its external editor relation reattached.

## Desktop window lifecycle and synchronization

Run `pnpm test:desktop:lifecycle` with the primary test server and Chrome available.
The test uses the downloaded native app with its own `lifecycle-data` and
`lifecycle-profile`, desktop port 37846, CDP port 39226, and a proxy on 37847 that
forwards only to the primary loopback server. Initial data is seeded through
Trilium's native sync setup. The database is retained for subsequent runs.

The test invokes the actual native window-close action with unfinished labels,
holds or fails the resulting write, verifies the window remains open, then retries
closing after saving and opens a new native window. It also tests delayed native
desktop/server sync with an unfinished draft, recovery-copy sync, offline saves,
and competing acknowledged edits. Evidence is in
`.test/trilium/evidence/desktop-lifecycle.json`. macOS keeps the app running after
window closure; process termination in test cleanup is not counted as successful
close handling or proof of abrupt-loss durability.
