# Progress

## 2026-09-17 — Working Willow chrome

Implemented plan steps 2–4: stable toolbar/status bar, responsive More, pane-local
Hide UI/Show UI, 200ms tooltips, keyboard navigation, widget-sourced shortcut
reference, state presentation and installation-specific Documentation. The widget
registry remains the authority; no adapter keymap is maintained. Toolbar viewport
actions persist locally, and resizing/hiding preserves the world-space center.

Build/package, both typechecks, 60 adapter and 184 widget unit tests, six packaging
tests, the ten-group chrome suite, four lifecycle groups, and Trilium navigation,
selection, zoom, title, persistence, native sync/recovery and browser/macOS
distribution and desktop lifecycle regression suites pass. Fixed a native bubbling-click
race that reactivated the map after opening Documentation.

[Evidence, screenshots and remaining acceptance](evidence/chrome/report.md).
The implementation is deployed to the isolated Trilium test instance.

## 2026-09-17 — Widget registry and host-menu foundation

Committed the design and agreed plan as `f9cfe78`, then implemented step 1 in `mr`
as `3c920a0`.
The widget now owns the command/shortcut registry used by keyboard handling,
menu hints and the exported keymap reference. Added selection-dependent command
descriptors, a reusable menu presenter and host context-menu requests that preserve
widget targeting. Host menus can live outside an inert editor and add pane actions.

Build, both typechecks, 184 widget unit tests and 46 adapter unit tests passed.
The corrected host-menu/menu/lifecycle suite passed 99 checks in three engines;
the isolated installed-package consumer passed in all three and renders its keymap
directly from widget metadata. [Evidence, failure history and limitations](../mr/docs/evidence/command-registry/report.md).

Next: mount the real Willow toolbar/status bar and connect its session/view state
using these APIs (plan step 2). The bars and shortcut modal are not implemented yet.

## 2026-09-17 — Toolbar/status bar implementation planning

Inspected design revision 6 against adapter `7fdfc1e` and widget `3e0d069`.
The local prototype browser review passed; generated light/dark, split, menu,
dialog and recovery captures were inspected. Production code is unchanged.

The [proposed implementation plan](design/toolbar-statusbar/implementation-plan.md)
keeps chrome in the adapter, adds reusable widget menu integration, and sequences
responsive behavior, hidden-UI restoration, help and production verification.
The user agreed that the widget must be the sole source of editor commands and
shortcuts. The plan now explicitly consolidates the widget registry and requires
the keymap reference, menu hints and toolbar tooltips to consume its metadata.
The user subsequently authorized committing the plan and starting implementation;
see the step-1 checkpoint above.

## 2026-09-14 — Borders at reduced Trilium UI zoom

Reproduced Chromium rounding 1px editor/checkbox borders to about 0.56px at 90%
UI zoom on macOS. Changed their painting to inset shadows, reserving the frame
space in padding so dimensions and text alignment stay correct. High-contrast
mode retains visible native/outline frames.

Build, both typechecks, 224 unit tests and 81 browser cases passed. Native Trilium
before/after checks covered UI zoom 100/90/80/67% with map zoom 100/200%. At 90%,
both strokes now measure approximately one CSS pixel. The fix is deployed to the
isolated test server; changes remain uncommitted. [Evidence and review steps](../mr/docs/evidence/milestone-d/host-zoom-borders/report.md).

## 2026-09-14 — One-second link hint adjustment

Reduced the hover delay to one second at the user’s request. Each re-entry still
starts a fresh timer. Updated the timing assertions and current usage documentation.
The rebuilt bundle is deployed to the isolated test instance.
Build and all 30 three-engine tooltip checks passed.


## 2026-09-14 — Repeatable two-second link hints

Replaced browser-native tooltips with an editor-managed hint: each mouse entry
into a link node starts a fresh two-second timer; exit hides/cancels it. Moving
between the label and checkbox within that node keeps the timer. Editing,
viewport changes, pointer presses, keyboard input and disposal cancel the hint.
The hint stays unscaled and inside the editor, with unchanged Cmd/Ctrl wording.

Build, both typechecks, 224 unit tests and 30 three-engine tooltip checks passed.
The updated bundle is deployed to the isolated Trilium browser and verified with
real-time repeated mouse hovering. Native desktop was not rerun for this UI-only
follow-up. [Timing, interaction and visual evidence](../mr/docs/evidence/milestone-d/tooltip-delay/report.md).
Changes remain uncommitted.

## 2026-09-14 — Root/title synchronization, link hints and clipboard

Implemented the approved behavior in the working tree based on `0309cfc` and
widget `7c53c4b`:

- Native note titles and committed root edits (including undo/redo) synchronize
  in both directions. First writable opening takes the existing title if the
  root differs, preserving children and IDs. Invalid maps are never aligned.
- Title typing updates the root after leaving the field. Pending initial saves
  pause during typing; first template loading is not treated as a remote edit.
  These guards prevent content/title acknowledgements replacing typed characters.
- Root-origin autosaves remain pending until both content and title requests
  succeed. Title failures retry; detected concurrent renames use existing recovery.
  Content recovery retains the chosen incoming root. Recovery copies use the copied
  root as their note title, preserving it when reopened.
- Link tooltips say **Cmd+click to open** on macOS, **Ctrl+click to open** elsewhere.
- Copied outlines omit the final newline. Empty labels use `\e` to preserve a
  single empty node or final empty sibling; literal backslashes remain escaped.

Added `pnpm test:title` and `pnpm test:title:desktop` (isolated macOS desktop
launch/cleanup). Updated existing fixtures to look up renamed notes and to assert
explicit recovery when a failed root save competes with a title edit. Previous
independent-title assertions are superseded by this approved behavior.

Verification and evidence are recorded in [the follow-up report](title-sync-verification.md).
Stock Trilium still uses separate non-atomic title/content writes: a process exit
between them can leave a mismatch, resolved by the title-wins rule on the next
fresh opening. This change does not add a server transaction or atomic conflict lock.
Changes are uncommitted; next step is user review, then committing the widget and
parent gitlink together when authorized.

## 2026-09-12 — Windows zoom isolation

Reproduced keyboard and Ctrl+wheel double zoom in stock Windows Trilium 0.105.0
with the add-on. Fixed event propagation in the widget and rebuilt/deployed the
shared bundle to isolated server and native desktop databases. Added focused
integration checks and Windows support to the manual desktop launcher, including
restoring stock desktop zoom shortcuts when copying a server-created fixture.
Build/typechecks, 194 unit tests, 24 three-engine widget cases and actual Windows
Electron/Chrome integration checks passed. Native macOS rerun and the broader
release matrix remain outside this focused verification. Full cause, evidence,
runtime adaptation and reproducible commands: [Windows report](test-windows.md).

Changes remain uncommitted in both this repository and the `mr` submodule; a
future release must include the widget change and update the parent gitlink.

## 2026-09-12 — Manual GitHub Actions

Committed distribution as `1a3edbc`, then implemented manual **Build** and
**Publish** workflows with a shared composite build action. Build derives
`<base>-dev.<run>.<attempt>` without touching the committed version. Publish
validates a plain base version, commits it locally when changed, packages
`<base>+build.<run>.<attempt>`, and pushes the tested commit with tag `v<base>`
atomically before creating/uploading/publishing a GitHub Release. Existing tags
are rejected; no force push or asset replacement is performed.

Packaging accepts `WILLOW_VERSION` and includes the base/full version, actual Git
HEAD, actual widget commit, dirty state, and workflow provenance in its manifest.
Installed labels and ZIP filenames use the full version. Both workflows upload
the ZIP, editor update file, installation instructions, and manifest.

Verified that `optifunc/mr` is private, so the shared action checks it out at the
root repository's gitlink commit using an explicit **`MR_READ_TOKEN`** secret.
That secret must be configured with read-only Contents access to `mr` before a
workflow can run. Publication uses the current repository's `GITHUB_TOKEN` with
explicit Contents write permissions. The current default branch is unprotected.
No repository settings or secrets were changed.

### Verification

- `pnpm package`, typecheck, and **31 adapter unit tests passed**.
- **Six packaging/publication tests passed**: dispatch/retry uniqueness, input
  rejection, Build/Publish mutation behavior, archive metadata/checksums and
  repeatability, exact version-commit/tag publication and duplicate rejection,
  and a concurrent branch change preventing the entire atomic push. All Git
  publication tests use temporary local bare remotes.
- `actionlint` v1.7.12 and shell syntax validation passed. Official actions are
  pinned to resolved commit SHAs.

These are local validations; neither workflow has run on GitHub and no tag or
release has been published. The browser/desktop integration suites remain local
gates; CI runs build, typecheck, adapter tests, and packaging/publication tests.
See [workflow setup and recovery](github-actions.md), including recovery from a
release-upload failure using the original tested run artifact after tagging.

## 2026-09-12 — Distribution

Committed the review fixes and desktop lifecycle coverage as `0913388`, then
completed the distribution step. The first experimental package is version
**0.1.0**, tested against stock Trilium **v0.105.0** in Chrome and macOS desktop.

`pnpm package` builds the editor and creates a reproducible native format-v2 ZIP
using Python's standard library; no running Trilium or packaging dependency is
required. The subtree includes the shared JSX editor and inline CSS, native
template, example map, and installation/update/removal instructions. Outputs:

- `dist/trilium-willow-0.1.0.zip` — importable add-on (35,164 bytes).
- `dist/willow-editor.jsx` — complete code for updating the existing shared note.
- `dist/installation.html` and `dist/manifest.json` — instructions and hashes.

Safe import renames executable relations to `disabled:renderNote` while preserving
their remapped internal targets. Open the template and example and use Trilium's
**Enable render note** control on each. No global startup script or separate
server is installed. User maps belong outside the package subtree.

Updating replaces the existing shared editor's code and preserves its note ID;
after saving, reload clients. Importing another ZIP creates another installation
and does not redirect existing maps. The first-release upgrade test uses a
compatible replacement fixture (the current bundle with a previous-release
comment), then installs the shipped editor bytes through Trilium's normal note
save endpoint. This establishes ID/content preservation and template continuity;
it does not establish historical release migration or a future document-format
change. The manual code-editor paste workflow is documented, while the test
performs the content replacement through the authenticated API.

### Verification

`pnpm package`, typecheck, and all **31 unit tests passed**. `pnpm test:distribution`
passed five groups independently in a fresh browser database and a fresh native
desktop database, using the exact same ZIP:

1. Safe import remaps relations; native activation opens the bundled example.
2. The native template menu creates a map outside the package; an edited label
   survives autosave and reload.
3. Replacing the shared editor preserves the exact existing JSON; the original
   template still creates new maps with independent root IDs.
4. Deleting the package leaves user JSON intact. Trilium shows its Render Note
   setup screen, and its native **Note source** view exposes the saved document.
5. Reimporting creates new editor IDs; reconnecting an old map with `renderNote`
   and `willowMindMap` restores the editor without changing the JSON.

The desktop fixture is initialized empty by the stock server, then the ZIP is
imported directly through the native renderer. It does not clone an installed
browser database. Import tests wait for Trilium's asynchronous import-completion
navigation before selecting template/example notes. Test processes are stopped
afterward; their SIGTERM cleanup adds no new window-close evidence.

Evidence: [distribution results](../.test/trilium/evidence/distribution.json), with
source-view screenshots and process logs in the reported run directory. The
primary test installation and `mr` submodule are unchanged. Editor SHA-256 remains
`3b7d67e61e2b47603fcbf782d45e5ac26551ccbf1bbe020bb3390e2d6e6787cc`;
package SHA-256 is
`5ba1981d7d871b13caad997eade4783447c023bbc12504a871fd3982da9a4720`.

The package remains experimental and local; no release has been published.
Other Trilium versions, Windows, and Linux desktop builds remain unverified.
The previously accepted native-sync and memory-only-draft limits still apply.
Internal links, migration from other map formats, and dedicated exports remain
deferred.

## 2026-09-12 — Review fixes and desktop lifecycle gates

Addressed all four review findings. Earlier completion summaries overstated
recovery guarantees and wrapper-remount coverage, and did not establish native
desktop closing or desktop/server conflicts. The results below supersede those
claims for the tested Trilium v0.105.0 browser and macOS desktop builds.

- **Recovery race:** moved busy state, recovery-copy identity, and recovery result
  into the shared document session. Both Keep both and confirmed discard validate
  draft/edit and incoming generations after asynchronous work, including the final
  read. A newer draft, even one changed back to the same text, invalidates the
  result without clearing the draft or earlier copy. Unfinished editing also
  invalidates it. Replayed identical incoming notifications are harmless. Busy
  state survives refresh and blocks editing/ownership transfer across panes.
- **Independent split views:** retain snapshots by note and pane context. A new
  wrapper can read the outgoing live snapshot before its cleanup runs; late
  cleanup cannot replace the new snapshot. Closing a pane clears its context
  snapshots. The document-wide local default remains for newly opened contexts.
- **Paused drag:** every user-origin viewport update marks the view for local
  persistence. Continuing the same drag after a debounce write saves the final
  position, including on teardown.
- **Desktop lifecycle:** a close attempt commits unfinished labels and starts
  saving, while keeping the window open until acknowledgement. Delayed writes
  must finish, and failed writes must be retried, before retrying window close.
  Added actual native close/new-window checks and actual desktop/server delayed
  and offline conflict checks using a separate desktop database and loopback proxy.

### Verification

Deployed bundle SHA-256:

```text
3b7d67e61e2b47603fcbf782d45e5ac26551ccbf1bbe020bb3390e2d6e6787cc
```

Build/typecheck and **31 unit tests passed**. The browser lifecycle (10), acceptance
(8), selection/focus (7), navigation, persistence (7), host integration (3), and
server-sync checks passed. Four new review groups passed in both browser and
desktop: refreshing distinct split views; delayed recovery with refresh;
ownership attempts during recovery; and paused drag/reload. The recovery tests
verify the UI lock and deliberately bypass it with a programmatic edit to verify
the independent generation guard, then read back both recovery copies and the
original. Unit tests additionally cover an unfinished edit, edit/undo back to the
copied text, delayed discard confirmation, and duplicate incoming notifications.

Six native desktop lifecycle/sync groups passed: initial bundle/map sync; closing
with an unfinished label and a delayed write; the same with a failed write and
Retry; delayed sync preserving an unfinished desktop draft in a synced recovery
copy; offline local saves followed by reconnection; and convergence of competing
already-acknowledged desktop/server edits. Native close events and new native
windows establish closing behavior. On macOS the process remains running after
its last window closes; SIGTERM used for final test cleanup is not close evidence.

The existing desktop creation, title isolation, clipboard, reload, navigation,
and selection/focus checks also passed. Browser tests and desktop fixture backups
must run sequentially: browser validation deliberately installs invalid JSON
temporarily, which must not be captured in the desktop test snapshot.

Evidence: [browser review regressions](../.test/trilium/evidence/review-regressions.json),
[desktop regressions](../.test/trilium/evidence/spike/desktop.json), and
[native desktop lifecycle/sync](../.test/trilium/evidence/desktop-lifecycle.json).
Run `pnpm test:trilium`, `pnpm test:hardening`, `pnpm spike:test:desktop`, and
`pnpm test:desktop:lifecycle` sequentially after deployment.

Native sync can still choose one complete document when two databases have
already acknowledged competing versions. Recovery remains in memory until saved;
forced termination and protected-session expiry with an unsaved offline draft are
not durability guarantees. Map-only archive imports still need their external
editor relation restored. These limits are separate from the fixed recovery race.
The `mr` submodule is unchanged. Distribution remains the next planned step.

## 2026-09-12 — Local selection memory and tree-click focus

Committed the preceding hardening/contrast work as `5a4b288` before this step.

- Extended local view state with selected node IDs and the active node. Older
  position/zoom records remain valid. Multiple selected nodes survive switching,
  reload, and widget remounts without changing the viewport. Filter deleted or
  hidden IDs before calling the widget, falling back to the root if none survive.
  Incoming content refreshes also preserve the surviving selection.
- A plain click on a native tree title/icon focuses that map in the active pane
  when ready, including clicks on the already-open note. Arrow keys then navigate
  the map. Newer pointer, key, or focus activity cancels pending focus; delayed
  loading respects a newer title click. Native creation/title focus is unchanged.
  One shared listener remains available between Render Note bundle executions.
- View state remains local per document/profile and independent between open
  panes. Selection IDs contain no labels or document text, do not mark the map
  dirty, and do not trigger content autosave. The `mr` submodule is unchanged.

Build/typecheck and 25 unit tests passed. Seven new real-input groups passed in
both browser and isolated desktop: click/arrow navigation, multi-selection and
view restoration, already-open note focus, stale/hidden IDs, incoming updates,
delayed title-focus protection, and unchanged document content. Desktop creation,
clipboard, reload, view restoration, and navigation regressions also passed.
The 10 browser lifecycle regressions, 8 acceptance groups, and delayed-response
navigation checks passed. A separate cold-start check verified focus on the first
Willow click after reloading on a normal note, before the bundle had loaded.

Deployed bundle: `a5808570463076b233960f6cbd52061b62935ac481accf18a9eab6d64f6bab3b`.
Evidence: [browser](../.test/trilium/evidence/selection-focus.json) and
[desktop](../.test/trilium/evidence/spike/desktop.json). The shared scenarios are in
[`scripts/check-selection-focus.mjs`](../scripts/check-selection-focus.mjs);
run `node scripts/test-selection-focus.mjs` or `pnpm spike:test:desktop`.

## 2026-09-12 — Restore light-mode selection contrast

Restored the widget's original `#d2d2d2` selection background in light mode;
the hardening change had inherited Trilium Next light's much paler `#f5f5f5`.
Dark mode still uses Trilium's accent (`#555` in Next dark). The dark selector
accounts for Render Note CSS scoping. Build passed and computed selected-node
backgrounds were verified in both themes on the test server.

Deployed bundle: `c4a2789797d498c6721d888b80e3bd9902009f56488495a51c332f09974100ea`.

## 2026-09-12 — Persistence and host hardening

Committed the preceding fixes/desktop launcher as `dfb5c86` before this step.
The initial hardening pass is complete; distribution is next.

### Fixes

- Read-only transitions now keep a newly committed, unfinished label in a
  retryable error state. Previously unlocking left that draft marked unsaved with
  neither a save timer nor a Retry action.
- Editor fields, selection, drag previews, and menus now follow Trilium's theme.
  Dark editing text previously had contrast 1.61:1 against a white field; the
  corrected Next dark field measures 9.67:1 (Next light: 21:1).
- Reproduced an old bundle response completing after a newer map had opened,
  leaving a blank pane. Pin the wrapper to its initial synchronous context, with
  a same-bundle fallback for late responses. Existing wrappers remain pinned on
  later navigation. Detached textareas commit through the widget's blur handler;
  replacement editors in the same pane inherit editing ownership. An unfinished
  label survives the deliberately reordered responses.

The `mr` submodule remains unchanged. These fixes are deployed to the test server.

### Verification

Tested bundle SHA-256:

```text
d86d85ffbd40e84d71348506933c1d36983bed8fb776c13065a9fe4def63893f
```

- Build/typecheck and 24 unit tests passed, including the new read-only regression.
- The existing 10 browser lifecycle regressions and 8 acceptance groups passed.
  Navigation checks include normal-note round trips, continuous previews, and
  intentionally out-of-order bundle completion while editing.
- Seven new persistence groups passed: delayed serialized saves/navigation;
  disconnected writes and retry; independent clients and conflict recovery;
  read-only transitions; exact revision restoration; deletion/undelete retaining
  a failed draft (no attempted write into a known-deleted note); and protected
  editing/logout. Clean protected logout removes decrypted editors and sessions;
  local storage contains view coordinates, not document text.
- Host checks passed actual clipboard copy/paste, light/dark editing contrast,
  and a native subtree export/import preserving exact JSON.
- Real native sync with a second loopback server passed bundle/map transfer,
  saving locally while offline, upload on reconnection, and updates in the other
  direction. Both processes used the same protocol and separate databases.
- The actual isolated desktop passed creation, editing, clipboard copy/paste,
  view restoration, and the navigation checks. The delay harness intercepts XHR
  at the frontend boundary so it exercises Electron's custom local protocol as
  well as HTTP. Interception is removed after each scenario.

Evidence: [persistence](../.test/trilium/evidence/hardening/browser.json),
[themes/clipboard/archive](../.test/trilium/evidence/hardening/host.json),
[native sync](../.test/trilium/evidence/hardening/sync.json),
[browser navigation](../.test/trilium/evidence/navigation.json), and
[desktop](../.test/trilium/evidence/spike/desktop.json).
Reproduce with `pnpm test:trilium`, `pnpm test:hardening`, and
`pnpm spike:test:desktop` after building/deploying the bundle.

### Confirmed limits

Native sync chooses one complete document when independent databases have already
acknowledged competing edits. The test reproduced that behavior; the add-on's
preflight checks and recovery controls cannot guarantee retaining both such
versions. Draft recovery remains in memory and does not survive abrupt process
loss. Clean protected-session logout was tested; forced expiry with an unsaved
offline draft is not covered by a durability guarantee.

A single-map archive retains the JSON but omits `~renderNote` pointing outside
that subtree. Restoring that relation to the installed shared editor reopens the
map. The round-trip test verifies this repair explicitly. Packaging must document
this and test relation preservation for the full add-on subtree. Dedicated map
export remains deferred.

## 2026-09-12 — Title isolation, continuous switching, hidden-pane layout

Committed the preceding UI work as `f68c647` before these fixes.

- Reproduced title typing changing the root to the first partial title. Also
  reproduced lost title characters when opening a new map triggered a content
  save during typing. Removed title following. New roots start as **Mind map**;
  note-title edits and root edits are independent. Template IDs are materialized
  for the editor and persisted on the first map edit, with no content write on
  opening. Existing root labels are preserved.
- Reproduced the normal-note transition bug: hidden-host measurements produced
  1px child nodes and a 1.8px root. Defer mounting until the pane has dimensions
  and recalculate layout on every hidden-to-visible transition.
- Keep an inert canvas preview during map-to-map replacement, removing it when
  the next canvas is ready, when switching elsewhere, on error/pane removal, or
  after five seconds. This covers the host's bundle-loading gap without keeping
  a detached live editor. Initialize editing ownership before the first paint so
  temporary viewer controls cannot shift the map.
- Added [`scripts/run-desktop.mjs`](../scripts/run-desktop.mjs), also available as
  `pnpm dev:desktop`. It builds and opens the downloaded app for manual testing,
  keeps it open, and preserves manual maps between runs. It uses its own
  `.test/trilium/manual-desktop-data` and `manual-desktop-profile`, separately
  from personal Trilium and automated test fixtures. Only the shared editor
  bundle is updated on subsequent launches.

### Verification

Tested bundle SHA-256:

```text
13eb7c56ae75582ffc5a26db92e5d5256b12e749232fe200fc501b5b3b63f634
```

Build/typecheck and 23 unit tests passed. The 10 browser lifecycle regressions and
8 acceptance groups passed with actual sequential title keystrokes (the earlier
atomic field-fill test missed the bug), native-menu creation, saves, view
restoration and conflict recovery. The actual isolated desktop passed the same
bundle and title-typing checks.

New navigation tests passed in both browser and desktop: three normal-note round
trips retain exactly the same node geometry; two map-to-map switches with an
artificial 180ms bundle delay have a live canvas or preview in every sampled
animation frame. Previews disappear when their replacements are ready and do not
remain on ordinary notes. The manual launcher was exercised both with the existing
build and with its default build-and-open command, reusing its database.

Evidence: [browser navigation frames](../.test/trilium/evidence/navigation.json),
[browser acceptance](../.test/trilium/evidence/vertical-slice/browser.json),
[lifecycle regressions](../.test/trilium/evidence/spike/results.json), and
[desktop acceptance including navigation](../.test/trilium/evidence/spike/desktop.json).
Manual-launcher evidence is in [manual-desktop.json](../.test/trilium/evidence/manual-desktop.json).
The `mr` submodule is unchanged. The remaining persistence/distribution work and
cross-client conflict limitations are unchanged.

## 2026-09-12 — Native creation, minimal controls, stable switching

The previous vertical slice was committed as `9442163` before this work.
The updated adapter is deployed to the isolated stock v0.105.0 test server.

- Right-click a tree note → **Insert note after** or **Insert child note** →
  **Willow Mind Map**, under Templates. Trilium supplies the native creation and
  title-editing flow. The old launcher/form and its creation-session model are removed.
- The template provides versioned JSON and inherited editor/icon attributes.
  New documents receive a unique root ID. The first native title edit initializes
  the root; that edit or a map edit ends title following. Existing maps keep their content.
- No permanent toolbar, Save/Fit/New map buttons, or duplicate Saved indicator.
  Autosave uses the native note-header badge. Retry/recovery and second-pane
  **Edit here** controls appear only when relevant. Fit uses Cmd/Ctrl+Shift+0.
- Wrappers are pinned to their invoking Render Note via `originEntity`, avoiding
  intermediate mounts for the next note. Editing-ownership initialization no longer
  rebuilds an editor whose effective mode is already correct. Pane sizing and view
  restoration precede revealing the canvas after fonts/layout are ready.
- First opening still centres the root at **100%**. Remembered views and split-pane
  independence remain intact; the `mr` submodule is unchanged.

### Verification

Tested bundle SHA-256:

```text
bb67c96bd8a83b4de0f6e5c4251eb166426e154e83ccd3480145bafb649141aa
```

Build/typecheck and **23 unit tests** passed. All **10 browser lifecycle regressions**
passed, alongside **8 browser acceptance groups** covering both native insertion
menus, unique IDs/title initialization, absence of permanent controls, editing,
view restoration, native failure feedback/retry (including a concurrent title save),
and both conflict-resolution paths.
There were no browser page errors.

Three measured browser switches each mounted **one** editor, compared with the
previous four-mount observation. Every sampled visible frame retained the same root
position and width. The actual isolated desktop app passed the same bundle,
native template creation, label autosave, view restoration, and a measured switch
with one mount and stable visible frames. This addresses the reproduced map flicker;
normal host loading time can still leave a brief empty pane.

The original and recovery documents survived restarting the isolated server, and
the browser restored its local view. Browser and desktop screenshots were inspected.

Evidence (ignored test artifacts, overwritten by subsequent runs):
[browser acceptance and frame samples](../.test/trilium/evidence/vertical-slice/browser.json),
[lifecycle regressions](../.test/trilium/evidence/spike/results.json),
[desktop acceptance and frame samples](../.test/trilium/evidence/spike/desktop.json),
[restart](../.test/trilium/evidence/vertical-slice/restart.json).
Reproduce with the commands in [README](../README.md).

Packaging and the broader persistence/host-hardening step remain pending. The
existing conflict limitation remains: preflight checks detect some competing edits
but do not provide an atomic cross-client lock.

## 2026-09-12 — Usable vertical slice (historical)

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
the former creation session (removed with native templates), [`view-state.ts`](../src/view-state.ts),
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
