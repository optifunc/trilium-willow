# Progress

## 2026-09-12 — Usable vertical slice

The next step is implemented on stock Trilium v0.105.0. Open
[Create a Willow mind map](http://127.0.0.1:37841/#root/wF38pKBoqN7i/Il9TKy0bqe3H)
in the isolated test server, or use **New map** in an existing map. The `mr`
submodule remains unchanged.

### Delivered

- Creation sets the root title, versioned JSON, editor relation, and identifying
  labels together through the stock note API. In-memory creation state survives
  host remounts, keeps retry IDs, and suppresses simultaneous duplicate submissions.
- Per-document local position/zoom persistence, stored as map coordinates at the
  viewport centre plus zoom. First opening centres the root at **100%**. Fitting
  remains manual. Split panes keep independent views; resize and ownership changes
  preserve their centres. View changes do not save note content.
- A per-note save coordinator replaces the spike's host saving hook. It serializes
  writes, checks current server content before writing, retains failed drafts
  across pane lifetimes, and reports unsaved/saving/saved/failure states. Reads
  bypass HTTP caching. **Retry save** is explicit after a failure.
- Detected conflicts pause further writes. **Keep both** commits unfinished text,
  creates a sibling recovery map, then loads the saved original. Failed recovery
  retains the draft and can be retried. **Use incoming** asks before discarding
  local work. No automatic tree merge is attempted.
- Invalid source is preserved with **View original source** and **Reload saved map**.
  A keyed widget container survives insertion/removal of status and recovery UI.

Implementation: [`save-session.ts`](../src/save-session.ts),
[`create-session.ts`](../src/create-session.ts), [`view-state.ts`](../src/view-state.ts),
[`host.ts`](../src/host.ts), and the wrapper in [`spike.ts`](../src/spike.ts).
Creation uses the standard note endpoint; backend scripting remains disabled.
The test environment and all evidence remain under ignored `.test/trilium`.

### Verification

Tested bundle SHA-256:

```text
9e7e7dc60b1b2355dff012dd488e116ba4beb8a44bae28fa5324be7bdad7e33a
```

- Build and typecheck passed; 22 unit tests cover envelopes, view coordinates,
  creation retries/remounts, serialized saves, in-flight echoes, failed writes,
  preflight conflicts, read-only changes during preflight, and lost responses.
- All 10 original browser lifecycle regressions passed against this bundle.
- Six new browser acceptance groups passed: creation/default view; restructuring,
  checkbox/collapse saves; view restoration without content writes; resizing,
  splits and ownership transfer; failed-save retry; and failed/retried Keep both
  with unfinished text and readback of both documents. No browser page errors.
- Manual browser verification also passed both **Use incoming** paths: Cancel
  retains the local draft; OK discards it and loads the saved original. The same
  scenario is included in the browser harness for subsequent runs.
- The actual isolated desktop app passed creation at 100%, label editing/saving,
  and pan/zoom restoration across note switching and renderer reload.
- The original and recovery copy survived a restart of the isolated server. The
  browser remounted the editor with its locally stored view state. Screenshots
  from the browser and desktop were visually inspected.

Evidence: [browser acceptance](../.test/trilium/evidence/vertical-slice/browser.json),
[browser screenshot](../.test/trilium/evidence/vertical-slice/browser.png),
[lifecycle regressions](../.test/trilium/evidence/spike/results.json),
[desktop acceptance](../.test/trilium/evidence/spike/desktop.json), and
[desktop screenshot](../.test/trilium/evidence/spike/desktop.png), and
[server restart](../.test/trilium/evidence/vertical-slice/restart.json), and
[discard confirmation](../.test/trilium/evidence/vertical-slice/discard.json).
The evidence paths contain the latest run; the first spike below is a historical
record of its earlier bundle and findings.

Reproduce with `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm spike:deploy`,
`pnpm test:trilium`, and `pnpm spike:test:desktop`. The restart check is
`node scripts/test-restart.mjs`; it checks the PID, listening port and process
working directory before restarting the disposable server.

### Next checkpoint and limits

Proceed to persistence and host hardening, followed by packaging/distribution.
The preflight read and write are separate operations; they do not prevent every
concurrent browser or offline desktop overwrite. A write already in flight cannot
be cancelled by a later conflict notification. In-memory drafts and retry IDs do
not provide crash recovery. Selection/undo continuity through mode remounts still
needs work; position and zoom are now preserved.

Further acceptance needs real cross-client/offline sync, protection transitions,
actual OS IME, full window-close behavior, revisions/restore, missing-addon
presentation, and desktop split/clipboard coverage. Failure testing so far covers browser saves and recovery;
those scenarios were not repeated in desktop. Internal links, migration and
preview/export remain deferred. No production installation package is delivered
by this checkpoint.

## 2026-09-12 — Render Note integration spike completed

Completed 2026-09-12. **The Render Note approach is viable on stock Trilium
v0.105.0.** The same shared bundle works in the browser and desktop renderer, and
the `mr` submodule is unchanged. This completes the first compatibility/lifecycle
spike; creation UI, distribution, and persistence/conflict hardening are later work.

### Delivered

- TypeScript adapter in [`src/spike.ts`](../src/spike.ts), using Trilium's own
  Preact, note context, effective read-only state, and `useEditorSpacedUpdate`.
- Versioned JSON envelope and focused validation tests.
- pnpm workspace consuming `mr` through its public exports. Vite emits one bundle
  with inline CSS and a host-provided Preact import.
- Deployment and browser/desktop verification scripts, restricted to the isolated
  `.test/trilium` environment.
- One editable pane per map in a frontend. A second pane is a viewer with an
  editing-transfer button. This is not a cross-device lock.

Live documents: [Map A](http://127.0.0.1:37841/#root/wF38pKBoqN7i/EekM4Wy4K6HE)
and [Map B](http://127.0.0.1:37841/#root/wF38pKBoqN7i/rXQy2E9SrEtx).
Each is `render` / `application/json` with a `renderNote` relation to the same
`code` / `text/jsx` editor note. Its own content contains the map, separately from
the shared code. Deployment retains maps; the test suite explicitly resets them.

### Findings and fixes

1. **Unfinished edits need no `mr` change.** Native textarea blur commits through
   the documented widget path. A handler registered before Trilium's saving hook
   preserves existing labels and provisional children on note switching/closing.
   Mouse navigation and Command+[ navigation passed. Actual OS IME is unverified.
2. **Split metadata belongs to Trilium.** Our initial `data-ntx-id` diagnostic
   collided with Trilium's descendant selectors, causing a new split to be
   inserted inside the map. Renaming it `data-willow-context` fixed the collision.
   Pane-relative sizing also replaced viewport-based sizing.
3. **Nested roots need a detach guard.** Native refresh ran cleanup, but tab
   removal initially left two detached editors. An outer boundary observes removal
   and unmounts the entire subtree that uses Trilium hooks. Editor and DOM counts
   now match after tab removal.
4. **The JSX root needs the CSS scope.** Trilium scopes injected CSS to
   `.render-note-scope`; its JSX mount does not reliably supply this ancestor.
   The explicit boundary provides it, making style application deterministic.
5. **Save echoes must not reset the editor.** Equal acknowledged/committed content
   is ignored, preserving editing state and undo history. Actual keyboard undo and
   redo passed across saves and their notifications.
6. **Invalid replacement reports an event.** The widget's `setDocument` does not
   throw for invalid replacement. The adapter checks its error event and removes
   the previous editor after a failed load so it cannot overwrite invalid source.

These are adapter changes. Trilium's application code and `mr` were not patched.

### Verification

Widget revision: `11468670eed9f433a5353c0513b34c3bf66128ee`.
Tested bundle SHA-256:

```text
9cff832ba006a8e08d93dba1b32622baa68eb9f19a00631f7af22d9c813cd2d7
```

| Check | Result |
| --- | --- |
| `pnpm build` | Passed: widget package and shared adapter |
| `pnpm typecheck` | Passed |
| `pnpm test` | Passed: 7 envelope cases |
| `pnpm spike:test` | Passed: 10 browser integration checks |
| `pnpm spike:test:desktop` | Passed: isolated desktop mount/edit/save/reload |
| `git diff --check` | Passed |
| `git -C mr status --short` | Clean |

The browser suite uses Chrome 152.0.7977.83 against the local server and verifies
shared loading, per-note saves, undo/redo, provisional-child commits, keyboard
navigation, native refresh, repeated A/B switching, separate split instances,
ownership transfer, tab-close cleanup, invalid-source preservation, and reopen/
reload persistence. There were no page errors in the final run.

Evidence: [browser results](../.test/trilium/evidence/spike/results.json),
[two panes](../.test/trilium/evidence/spike/two-panes.png),
[reopened map](../.test/trilium/evidence/spike/reopened.png),
[desktop results](../.test/trilium/evidence/spike/desktop.json), and
[desktop screenshot](../.test/trilium/evidence/spike/desktop.png).
Screenshots were visually inspected. Evidence is ignored; the scripts regenerate
it in this environment. Early exploratory failures led to the fixes above; final
results refer to the final bundle, not those failed runs.

### Desktop verification

The official v0.105.0 macOS ARM64 ZIP was downloaded to `.test/trilium/downloads/`
and extracted into `.test/trilium/desktop/`. Its release SHA-256 was verified:

```text
441901c820214580c109b1e6ec8e4e9651863e7e0e5401f882a7bf120db43c2b
```

The app uses `TRILIUM_DATA_DIR=.test/trilium/desktop-data`,
`TRILIUM_ELECTRON_DATA_DIR=.test/trilium/desktop-profile`, and port 37842.
The test takes a consistent SQLite backup of the disposable server's database,
using the test dependency `.test/trilium/tools/node_modules/better-sqlite3`.
It verifies the bundle hash inside the actual desktop renderer before editing.
This proves artifact portability, not live synchronization.

Playwright's Electron main-process handshake timed out although the app launched.
Renderer control through CDP port 39223 worked. The harness handles Electron's
native unload-dialog/CDP race and verifies saved content after renderer reload.
The desktop test app is closed afterward; the original web server remains running.

The pre-existing `/Applications/Trilium Notes.app` reports v0.104.1. It and its
personal database/profile were not used or modified. Only v0.105.0 is established
as a tested spike baseline; older releases remain unverified.

### Remaining limits and next checkpoint

This is a prototype for disposable testing, not a production persistence layer:

- Incoming conflicts pause new save snapshots and show an error, but **Keep both**
  recovery is not implemented. In-flight writes, retries during conflicts,
  simultaneous transfers, and offline races need the hardening phase.
- Failed saves/retries, late responses, protection transitions, actual IME,
  browser/window closing during typing, and full desktop split/clipboard behavior
  are unverified. In-memory drafts are not crash recovery.
- Read-only/ownership changes remount the widget and reset undo/selection;
  preserving viewport and continuity during mode changes needs refinement.
- Internal links, migration, and preview/export remain deferred. Missing-addon
  presentation, revisions/restore, and live desktop/server sync were not tested.
- Firefox/Safari and a wider Trilium-version matrix remain unverified.

Proceed with Render Notes. The next checkpoint is the usable vertical slice:
creation template/launcher, document validation/recovery UI, reliable save-state
feedback, and a testable save/conflict coordinator. Retain the host-boundary and
lifecycle fixes established here.
