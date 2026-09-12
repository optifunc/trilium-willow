# Progress

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
