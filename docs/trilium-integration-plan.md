# Trilium mind-map add-on: options and proposed plan

Date: 2026-09-12. Status: initial persistence/host-hardening pass complete; distribution next.

Environment checkpoint: the isolated v0.105.0 server is running under
`.test/trilium`, and browser setup, editing, independent-session readback, and
server-restart persistence passed. See [test-server report](test-trilium.md).
The adapter now includes creation, save/recovery UI, and local view persistence
on stock v0.105.0 in Chrome and an isolated macOS desktop renderer. See [findings, evidence, and limits](progress.md).

User preference: an add-on for stock Trilium, running the latest version.
Confirmed scope: desktop and browser; standalone documents. Internal note links,
existing-map migration, and dedicated map export are deferred.
The planning baseline is the latest stable TriliumNext v0.105.0, whose source was
inspected; confirm the exact build when setting up the prototype. Older
Trilium releases, including the original zadam fork, are not assumed compatible.

## Findings

The `mr` submodule is pinned at `11468670eed9f433a5353c0513b34c3bf66128ee`.
It provides a framework-independent TypeScript editor, distributed as ESM and CSS.
Its documented features include editing, layout, clipboard outlines, undo/redo,
read-only mode, change events, viewport control, and explicit destruction.
See [API](../mr/docs/api.md), [types](../mr/src/types.ts), and
[progress and existing verification](../mr/docs/progress.md).

Trilium explicitly documents Render Notes as a way to supply custom editors.
Each Render Note points through `~renderNote` to shared executable code. A Preact
wrapper can mount the imperative `MindMapEditor` into a DOM element; the widget
itself does not need to adopt Preact.

The v0.105.0 frontend scripting API exposes `useNoteContext`,
`useEditorSpacedUpdate`, and `useEffectiveReadOnly` through `trilium:preact`.
The saving hook loads note content, writes through Trilium's note-data endpoint,
reports save state, and flushes on note switches and context removal. This is a
tested integration path. The spike verified note context, saving, refresh, splits,
and cleanup, with adapter workarounds documented in the progress log. Broader persistence
and conflict hardening remains pending. The usable version retains the host's note
loading and lifecycle events, but replaces `useEditorSpacedUpdate` with a per-note
save coordinator using the normal note-data endpoint. This gives conflict handling
control over queued writes and retries. Creation uses Trilium’s native template menu and note-creation endpoint; recovery
copies use the same endpoint with explicit content and attributes. Backend scripting
remains disabled in the test installation.

Current Trilium already has a `mindMap` note type using Mind Elixir. Its format
is different from `mr`'s document format. The add-on should use its own identity
and must not store `mr` JSON in native `mindMap` notes.

`contentWidget` is not a general custom-editor registration API: the inspected
implementation maps built-in note IDs to built-in components. Similarly, the
documented custom-widget API offers locations in the UI, rather than registration
of arbitrary native note types. A truly new native type would involve core changes.

## Integration options

| Approach | Stock installation | Experience | Cost and limitations |
| --- | --- | --- | --- |
| **Render Note with shared editor bundle** | Yes | Open a map in the normal note pane; create it from a template or launcher | Recommended. Must implement persistence/lifecycle correctly. Underlying type remains Render Note. |
| **JSON Code Note plus a note-context widget** | Yes | JSON remains directly editable; a widget displays the map alongside it | Useful fallback or developer-oriented mode. More UI coordination; two editors must not race. Hiding/replacing the standard editor through DOM manipulation would add fragility. |
| **Separate web editor, linked or embedded, using ETAPI** | Yes | Separate application or embedded page backed by Trilium notes | Requires hosting, authentication, save coordination, and embedding/clipboard checks. Attractive mainly if the editor also needs to work outside Trilium. |
| **Core integration or upstream contribution** | No, until released upstream | Dedicated type, native creation menus, deeper export/search integration | Broadest integration and largest maintenance scope. Not the preferred first route. |

Overriding the built-in mind-map editor at runtime is a possible hack, but not a
recommended option: it couples the add-on to internal registration and an
incompatible existing format.

## Proposed document model

Confirmed: one Trilium note represents one mind-map document. Individual nodes are
items inside that document, not individual Trilium notes. Mapping every node to a
Trilium note is a separate product: cloning, multiple parents, ordering, deletion,
and undo across backend writes would need their own design.

Each document is a Render Note containing versioned JSON, for example:

```json
{
  "format": "trilium-willow-mindmap",
  "version": 1,
  "document": {
    "root": { "id": "root", "text": "Plan", "children": [] }
  }
}
```

Proposed labels: `#willowMindMap` for identification and a suitable `#iconClass`.
Use `~renderNote` to reference one shared installed editor. A template or launcher
sets these up, so users do not hand-wire relations for each map.

The JSON belongs in the map note's own content, not in attributes or a shared
script note. This keeps document identity and storage together and uses Trilium's
normal note storage. Verify revisions, sync, duplication, protection, and export
round trips in the target release before promising complete integration.

Alternative storage: a Render Note pointing to a related JSON Code Note. This
provides an obvious raw-data editor but creates two-note lifecycle and duplication
problems. Use it only if the one-note spike reveals a concrete limitation.

Keep selection, pan, and zoom out of persisted document history in v1. Collapsed
and checkbox states remain document fields because that is `mr`'s current contract.
The root text and native note title stay synchronized in both directions. On
first writable opening, the existing note title wins if they differ; preserve
children, IDs and other fields. Validate the full map before making this change.
Template root IDs are materialized per document on the first save.

Native title typing is applied to the root after leaving the title field. Pause
pending initial alignment saves during typing: content acknowledgements can reset
Trilium's title input. Committed root edits and undo/redo rename the note through
the shared save session. Child edits do not rename it. Root-origin saves remain
pending until both the content and title requests succeed; failures are retryable.
Detected concurrent title changes preserve the draft and require explicit recovery.
Content-conflict recovery keeps the chosen incoming root and synchronizes its title;
title-conflict recovery applies the incoming title. Recovery copies use their copied
root as the title, so reopening them preserves that root exactly.

Stock Trilium provides separate content and title writes, with no atomic combined
update or compare-and-swap. Preflight checks detect observed conflicts but cannot
eliminate the last read/write race. A process exit between those writes may leave
a mismatch; the agreed title-wins rule applies at the next fresh opening. Existing
session drafts remain available for retry/recovery while that session is alive.

### Native creation and controls

Use a Render Note template named **Willow Mind Map**, marked `#template`, with
inheritable `~renderNote`, `#willowMindMap`, and icon attributes. Stock Trilium
lists it under Templates in both **Insert note after** and **Insert child note**.
The host chooses the parent and sibling position and handles creation/title focus.
No context-menu patch or startup script is needed. Opening the template itself
shows instructions; documents created from it open the editor.

There is no permanent toolbar, creation form, Save button, Fit button, or duplicate
Saved indicator. Autosave reports through Trilium’s note-header badge, including
failures; a title-save acknowledgement must not hide pending map work. Fit remains
available through **Cmd/Ctrl+Shift+0**. Show only contextual controls: **Retry save**,
**Keep both**, **Use incoming**, invalid-source actions, and **Edit here** in a
second pane viewing the same map.

Pin each wrapper to its initial synchronous note context, and rebuild the editor
only when the effective read-only mode actually changes. If an older request for
the same shared bundle completes after navigation, serve the current Willow note;
keep the wrapper pinned thereafter. A host replacement commits detached textarea
text through the normal blur handler and transfers ownership to the replacement
in the same pane. Wait for a measurable pane before mounting and recalculate layout on each
hidden-to-visible transition. The host can leave a Render Note hidden briefly
after switching from a text note; measurements taken then are invalid. Restore
the view before revealing the canvas. During map-to-map replacement, retain an
inert preview of the old canvas until the new one is ready to paint. Remove the
preview on a non-Willow destination, error, pane removal, or a five-second timeout.
No live editor is retained after its pane is removed, and first opening never fits.

## Remembered position, zoom, and selection

Implemented in the usable vertical slice: remember the view per document locally
in each browser or desktop profile. Restore it on note switching, reopening, and
application reload. Desktop and browser retain independent views; view changes
do not write note content, mark the document dirty, or enter document history and
save-conflict handling.

- Store the map coordinates at the viewport centre and the zoom factor, rather
  than raw pixel offsets, so restoration accommodates different pane sizes.
- Store selected node IDs and the active node alongside the view, without labels
  or document text. Keep existing v1 position/zoom records compatible. Restore
  only visible surviving IDs, using the root when none remain, without moving
  the viewport or expanding branches. Preserve selection on incoming content
  refreshes and widget remounts too.
- With no saved view, centre the root at **100% zoom**. Do not automatically fit
  the map on first opening. Keep **Fit map** as an explicit user action.
- Keep simultaneous split panes independent. Preserve each pane's view through
  widget remounts and editing-ownership transfers; use the most recently interacted
  view as the document's local default for a newly opened pane.
- Retain snapshots by note and pane context across complete wrapper replacement,
  taking the outgoing live snapshot even if the replacement mounts before cleanup.
  Discard context snapshots when the native pane closes.
- Debounce local storage writes and capture the final view before teardown.
  Validate stored values; missing or invalid state uses the centred 100% default.
- Each user-origin viewport update schedules persistence, including movement after
  pausing during one drag. A debounce write does not end the gesture.
- Use the widget's existing viewport and selection events/getters/setters in the
  adapter. No widget change is required.

A plain left click on a Willow title/icon in Trilium's tree requests keyboard
focus for that map in the active pane once it is ready. Clicking the already-open
note does the same. Newer pointer, keyboard, or focus activity cancels a pending
request; do not steal focus from native title editing or other controls. Native
creation/title focus remains under Trilium's control. The adapter uses the v0.105
Fancytree row identity and scopes the focus request to the clicked note and active
context. Modifier clicks and context menus do not request map focus.

Verify first opening, note switching, reload, pane resizing, independent splits,
and editing-ownership transfers in browser and desktop. A synced **Save as opening
view** action remains an optional future extension; automatic view persistence is
local only.

## Adapter responsibilities

1. **Loading and validation.** Resolve the owning note from its pane context,
   not the globally active note. Parse the format/version and validate the map.
   Unknown versions or invalid JSON must show a recoverable error without writing
   an empty replacement. Initialize empty content only for deliberate creation.
2. **Saving.** Retain committed `documentchange` snapshots and mark pending saves
   through the per-note save coordinator. Suppress writeback for host-driven replacement.
   Serialize saves, retain failed changes for retry, and never report success
   before acknowledgement. Read the current server content without HTTP caching
   before each write; this detects some conflicts but is not an atomic comparison.
3. **Unfinished edits.** `getDocument()` excludes the textarea buffer and can
   contain provisional nodes; `destroy()` discards unfinished edits. Commit before
   saving on navigation, tab close, and explicit refresh. Prototype a controlled
   focus/blur path first. If this cannot cover keyboard navigation, IME, and event
   ordering reliably, add a small public commit-edit API to `mr` with focused tests.
   Never persist arbitrary edit-time snapshots as committed content.
4. **Multiple views and incoming changes.** One editor per pane. Avoid replacing
   the document for a save echo, since `setDocument()` resets selection/history
   and discards the edit buffer. Apply external updates only when clean; preserve
   local work and offer reload/recovery when dirty. No automatic tree merge in v1.
   Separate clients can still race under ordinary Trilium synchronization; this
   plan does not promise collaborative editing or atomic cross-client conflict
   prevention without further backend support.
   Apply the proposed conflict policy below rather than blindly feeding incoming
   content into `setDocument()`.
5. **Lifecycle.** Commit and flush before teardown; unsubscribe and destroy on
   actual unmount; handle refresh, hidden tabs, split removal, and stale async loads.
   Use a measurable, resizing host and scoped theme styles.
6. **Read-only and protection.** Honor Trilium's effective read-only state. Since
   the current widget has no public read-only setter, handle changes with controlled
   remounting unless a narrowly scoped API addition proves preferable. Verify
   protected-session expiry and avoid writing sensitive drafts outside Trilium.
7. **Keyboard ownership.** Check Enter, Tab, Delete, copy/paste, undo/redo, and zoom
   against Trilium's global shortcuts using real input. Keep host navigation usable.

Native Trilium links are a later extension: `mr` currently recognizes whole-label
HTTP(S) links only and has no separate link-target field. Supporting a node titled
“Project” that opens a Trilium note needs an explicit model/API decision, possibly
adapter metadata keyed by stable node ID plus appropriate widget interaction hooks.
Do not assume the existing `linkopen` event supports arbitrary internal links.

## Appearance without the add-on

The add-on consists of ordinary script/style/template notes in the database,
not a separately installed OS extension. A complete desktop/server database sync
can carry both the documents and their shared editor bundle. Compatible clients
still need active content enabled; verify activation after import and sync.

If only a document is copied into an unrelated database, or its editor bundle is
deleted/disabled, its title, tree entry, attributes, and JSON content remain. It
does not fall back to Trilium's native mind-map viewer. Depending on whether the
render relation is missing, disabled, or points to an unavailable script, the
normal pane can show setup, a disabled-content notice, or a rendering error.
Confirm these exact cases in the prototype. Trilium's Note source feature is the
planned raw-JSON recovery path and must be included in that verification.

With export/previews deferred, v1 does not promise a readable map preview without
the bundle. A future static outline or image fallback would need a separate
artifact and a presentation path stock Trilium can render without our code.

## Conflict policy

This is single-user editing with recovery for detected conflicts, not concurrent
collaborative editing. The following is the accepted target behavior; only the
scope recorded in the progress log is implemented and verified so far.

| Situation | Proposed behavior |
| --- | --- |
| Same map in multiple panes of one frontend | One editable pane per map; other panes are read-only viewers. Explicitly transferring editing commits and flushes the previous pane first. Use a per-frontend coordinator, not a lock stored as a synced label. |
| Another client changes a map with no local changes or active edit | Load the incoming version; preserve viewport where possible. A real replacement may reset widget undo history. |
| Incoming content equals our acknowledged save | Ignore the save echo; preserve selection, active editing, and undo history. |
| Another client changes a map while this editor is dirty or editing a label | Pause autosave, retain the local committed snapshot and unfinished edit, and show a conflict state. Never silently replace the local buffer. |
| Resolving a detected conflict | Offer “Keep both” (recommended): save local work as a new sibling document, then load the incoming original. “Use incoming” explicitly discards local work. Do not offer automatic tree merging in v1. |
| Saving or creating the recovery copy fails | Keep the conflict/draft in memory, keep retry available, and do not report it saved or discard it. In-memory recovery does not survive an abrupt process loss. |

Maintain the last acknowledged base content, current local content, and incoming
content. Treat an active textarea/provisional creation as dirty even when no
`documentchange` event has fired. Protect against stale callbacks using the owning
note ID and a generation token; serialize writes within each frontend.

These safeguards do not prevent every cross-client conflict. The inspected normal
save route accepts content without an expected-base revision, and checking before
a write alone is not atomic. Separate browser sessions can race against the same
server; desktop instances can also edit independent local databases while offline.
Trilium documents last-write-wins sync for note content, without tree merging.
Changes can be overwritten before the add-on observes them, including changes
already acknowledged as locally saved. Do not promise that automatic revisions
preserve every intermediate edit.

If guaranteed retention of all concurrent versions is required, revisit the
architecture before implementation. A backend compare-and-set operation could
protect cooperating writers to one database, but would not by itself protect
independent desktop databases during offline sync. Append-only version records or
operation-based merging would be a larger persistence design.

## Build and distribution

Keep this repository as the Trilium adapter; retain `mr` as the widget submodule.
Use TypeScript and the existing pnpm/Vite conventions. Bundle the widget locally
into Trilium-compatible script output; leave `trilium:preact` as a host import.
Do not assume a normal npm ESM import works directly in a Trilium script note.

Proposed source layout after implementation is authorized:

```text
mr/                     Existing widget submodule
src/document/           Format validation and future migrations
src/trilium/            Preact wrapper, persistence and lifecycle bridge
src/creation/           Native new-map template support
scripts/                Build and import-package generation
tests/                  Adapter logic and actual Trilium browser scenarios
docs/                   Plan, installation and compatibility evidence
```

Deliver a self-contained importable note subtree containing the shared code,
styles, template, and example map. No CDN dependency or separate
application server. Document Trilium's normal activation of imported executable
content. Keep user documents outside the add-on subtree so updates and removal do
not replace map data. Test relation preservation and bundle upgrades explicitly.

Development can use a disposable locally hosted Trilium driven by Playwright via
terminal tools, with screenshots inspected using image tools. No dedicated browser
connector is exposed in this session; Node, pnpm, Chrome, and cached Playwright
browser binaries are present. Dependencies are installed and the browser/desktop
spike tests are recorded in the progress log.

Use the same add-on artifact on browser and desktop, with no Electron/Node-specific
APIs in the adapter. Transfer by importing the bundle or syncing its notes along
with the maps. Browser results establish shared UI behavior; desktop acceptance
must additionally cover shortcuts, clipboard, focus, closing the window, and
desktop/server synchronization, including delayed and offline conflicts.

These desktop gates are exercised by the isolated desktop suites, including
`pnpm test:desktop:lifecycle`. Native window closing commits an unfinished label
and blocks while its write is delayed or failed. Retrying after a successful save
closes the window; a new native window restores the saved label. On macOS the app
remains running after its last window closes; process cleanup is not counted as
window-close evidence. Actual desktop/server sync tests cover unfinished drafts
during delayed sync, recovery-copy transfer, offline saves/reconnection, and
whole-document convergence of competing acknowledged versions.

## Implementation sequence and acceptance

1. **Compatibility and lifecycle spike — complete.** Confirm the exact desktop/server builds.
   In a disposable stock Trilium instance, import a tiny
   Preact Render Note, mount `mr`, load/save JSON in that same note, and open two
   maps plus two views of one map. Prove context identity, tab/refresh cleanup,
   unfinished-label commits, and package loading. Establish the minimum supported
   version from evidence. This checkpoint decides whether to retain the preferred
   approach or use the JSON-note fallback.
2. **Usable vertical slice — implemented.** Implement the versioned format, shared wrapper,
   native template menus, host autosave feedback, error recovery, and local position/zoom
   persistence as specified above. Acceptance: create
   a map, edit/restructure/check/collapse, navigate away, reopen and restart Trilium,
   and recover exactly the committed document without cross-note writes. Restore
   the locally remembered view; a first opening centres the root at 100% zoom.
3. **Persistence and host hardening — initial pass complete.** Exercised delayed and failed saves, rapid
   A-to-B switching, duplicate views, external updates, deletion, protection,
   read-only transitions, light/dark themes, sizing, and clipboard shortcuts. Tested
   revisions/restore, real sync with a second database, and native export/import.
   Fixed read-only draft retry, dark editing contrast, and out-of-order bundle
   completion losing the current editor. Follow-up review fixes coordinate recovery
   in the shared session and validate draft/edit and incoming generations after
   each asynchronous boundary, including the final read. Newer work aborts the
   recovery result; the earlier copy and newer draft remain available. Both Keep
   both and confirmed discard use this guard. Pane refresh and ownership attempts
   during recovery are covered explicitly. This is not durability across forced
   termination or a guarantee that native sync retains competing saved versions.
   Two accepted limits remain: native offline sync can replace an already saved
   competing version, and a single-map archive omits the external editor relation.
   See the [hardening results](progress.md) for exact evidence and scope.
4. **Distribution — implemented.** `pnpm package` creates a native format-v2 ZIP
   containing the shared JSX/CSS, template, example, and installation instructions,
   plus a standalone editor update file and SHA-256 manifest. Fresh browser and
   macOS desktop tests exercise safe-import activation, template creation outside
   the subtree, compatible shared-code replacement preserving IDs and JSON,
   removal with native source recovery, and reinstall/reconnection. Updates retain
   the existing editor note ID; importing another ZIP creates another installation.
   This first experimental release tests compatible replacement, not migration
   from a historical published release or across document formats. The supported
   evidence remains Trilium v0.105.0; other versions/platforms are unverified.
5. **Optional follow-ups.** Internal note links, native-format import, SVG/PNG
   previews, embedded read-only maps, print/share output, and better search
   indexing. The widget's HTML/SVG renderer is not itself a complete SVG exporter.

Use focused unit tests for serialization and save coordination and real browser
tests inside Trilium for lifecycle and gestures. Existing widget test results do
not establish host integration correctness. Actual-app spike results are recorded
separately in the progress log.

## Confirmed scope

- Desktop and browser are required. User reports “latest”; confirm exact builds
  against the v0.105.0 stable baseline during prototype setup.
- Standalone documents are accepted.
- Position and zoom are remembered locally per document and client profile; first
  opening centres the root at 100% zoom without automatic fitting.
- Internal note links, existing-map migration, and dedicated map export are deferred.
- Recovery for detected conflicts is accepted. Guaranteed preservation of all
  concurrent versions is outside the current scope.

## Sources

- [Render Note documentation](https://docs.triliumnotes.org/user-guide/note-types/render-note)
- [Custom widget locations and Preact support](https://docs.triliumnotes.org/user-guide/scripts/frontend-basics/custom-widget)
- [Native Mind Map documentation](https://docs.triliumnotes.org/user-guide/note-types/mindmap)
- [Trilium v0.105.0 release](https://github.com/TriliumNext/Trilium/releases/tag/v0.105.0)
- [v0.105.0 public Preact exports](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/services/frontend_script_api_preact.ts)
- [v0.105.0 note context, saving and read-only hooks](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/widgets/react/hooks.tsx)
- [v0.105.0 Render Note context bridge](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/services/render.tsx)
- [v0.105.0 Render Note missing/disabled relation UI](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/widgets/type_widgets/Render.tsx)
- [v0.105.0 normal note save route](https://github.com/TriliumNext/Trilium/blob/v0.105.0/packages/trilium-core/src/routes/api/notes.ts)
- [Note source and raw content access](https://docs.triliumnotes.org/user-guide/advanced-usage/note-source)
- [Desktop/server synchronization](https://docs.triliumnotes.org/user-guide/setup/synchronization)
- [Synchronization conflict resolution](https://docs.triliumnotes.org/developer-guide/concepts/sync)
- [Inspected content-widget registry](https://github.com/TriliumNext/Trilium/blob/b81d4a073f97f216dd308b2a98c86eb0b87e908f/apps/client/src/widgets/type_widgets/ContentWidget.tsx)
- [Inspected native Mind Elixir integration](https://github.com/TriliumNext/Trilium/blob/b81d4a073f97f216dd308b2a98c86eb0b87e908f/apps/client/src/widgets/type_widgets/mind_map/MindMap.tsx)
