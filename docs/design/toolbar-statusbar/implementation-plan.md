# Toolbar and status bar implementation plan

Status: implementation authorized, 2026-09-17. Steps 1–4 are implemented; step 5
has passed the automated browser/macOS integration checks; manual accessibility,
remaining platform/theme coverage and user visual acceptance are still pending. The design/plan baseline is committed as `f9cfe78`.

Step 1 supplies the widget command/shortcut registry, exported keymap reference,
shared host-menu presenter and context-menu integration callback. The packaged
consumer demonstrates the metadata and menu APIs. See the
[implementation evidence](../../../mr/docs/evidence/command-registry/report.md).
The Willow toolbar, status bar, responsive menus, pane visibility and widget-sourced
shortcut modal are now integrated. See the [adapter evidence](../../evidence/chrome/report.md)
for checks, screenshots and remaining acceptance.

The visual and behavior contract is [design revision 6](toolbar-statusbar-design.md).
Inspection used adapter `7fdfc1e` and widget `3e0d069`. The prototype is an appearance
reference and interaction fixture; its simulated editor/session code should not be
ported into production.

## Inspection findings

- The design covers the main product decisions: 45px toolbar, 34px status bar,
  responsive More menu, original SVG icons, 200ms tooltips, shortcut dialog,
  Documentation, and pane-local Hide UI/Show UI. Normal status text is empty;
  saving remains in the native Trilium header.
- Existing editor APIs cover the content and viewport commands. Status zoom
  buttons need additive `setZoom` steps; keyboard zoom remains multiplicative.
- `mr/src/interaction/menu.ts` already owns command order, labels, shortcuts and
  menu navigation, but is private. Its renderer accepts only editor commands,
  mounts inside the editor, and restores focus only to the canvas.
- Actual keyboard bindings are separately defined in `mr/src/interaction/input.ts`,
  with additional input handling for clipboard, label editing and context menus.
  Exporting menu descriptors alone would leave shortcut behavior and labels
  duplicated. Consolidating their definitions is part of this implementation.
- The built-in context menu only opens with a node target. It cannot currently
  restore hidden bars from blank canvas, empty selection, or an unavailable editor.
- `src/spike.ts` owns mount/disposal, ownership, recovery and the editor ref.
  This is the integration point, but reusable UI belongs in separate modules.
- `src/view-state.ts` preserves the world-space center and zoom through resize.
  Toolbar actions use API-origin events, so they must explicitly mark user
  interaction for local view persistence. Raw pixel pan offsets can change when
  canvas dimensions change; the visual center and zoom must remain stable.
- Documentation navigation and installation resolution do not exist yet.
  Packaged help already has a `willowAddon` label and contains the shared editor.

## Recommended architecture

Keep Willow chrome in the Trilium adapter. Make a small, backward-compatible
extension to the widget for shared commands, shortcuts and menu integration. Widget product
requirements explicitly leave application toolbars/status bars to consumers.

**Agreed source-of-truth rule:** the widget owns one authoritative command and
shortcut registry. Its keyboard handlers, built-in menu and public descriptors
consume that registry. The adapter consumes the widget's public metadata for
toolbar/More labels, shortcut tooltips, `aria-keyshortcuts` and the entire keymap
reference (the Keyboard shortcuts dialog). No adapter-maintained keymap or copied
shortcut strings from the prototype.

Registry entries describe stable action/command IDs, labels (including dynamic
variants), structured bindings, applicable input context, platform modifiers,
alternate bindings and reference grouping. Widget command handlers remain the
authority for execution and `canExecute`; the registry references those paths
without duplicating reducer rules. A widget-owned formatter produces display
labels and accessibility notation from the same binding data.

Cover canvas commands, label-editing actions, clipboard and context-menu opening,
including entries absent from the node menu. Native text editing and clipboard
remain native; metadata describing those bindings must not introduce competing
keydown interception. Gestures shown in the reference, such as Primary+click to
open a link, also come from widget metadata. Input-context and IME guards stay
in the appropriate handlers. This is a consolidation of existing behavior, not
a shortcut rebinding/settings feature.

The adapter owns layout, icons, responsive placement and host-only actions. It
may choose the preferred binding for compact tooltips and group reference rows
using widget metadata, but must not invent or override editor bindings. The
reference remains available without a loaded document and must not filter out
commands merely because the current selection makes them unavailable. Preserve
the specified shorter toolbar label “Add sibling” as a widget-provided display
variant of “Add sibling after.” Status ±10-point zoom remains an explicit host
control using `setZoom`; do not imply it has the multiplicative keyboard binding.

| Owner | Responsibility |
|---|---|
| New widget command/shortcut registry, existing input handlers, public types/exports | Authoritative command and binding metadata, keyboard resolution, platform formatting and keymap-reference data |
| `mr/src/interaction/menu.ts`, `mr/src/editor.ts` | Registry-derived command descriptors with current applicability; reusable menu rendering; optional host context-menu handling after existing node targeting |
| New `src/chrome/` modules | Toolbar, responsive action composition, status, tooltips, SVGs, widget-sourced shortcut dialog, pane-level menus, scoped CSS |
| `src/spike.ts` | Supply editor/session state and existing recovery/ownership callbacks; manage chrome lifecycle alongside the editor |
| `src/view-state.ts` | Continue view retention; account for explicit toolbar interaction without serializing presentation state |
| New `src/documentation.ts`, `src/host.ts`, `src/trilium.d.ts` | Resolve associated help note and navigate using the installed Trilium API |

The exact exported API names should be settled in step 1. The intended contracts:

1. A read-only descriptor snapshot provides stable command identity, label,
   command, registry-derived shortcuts, grouping and current enabledness. It reads the active node
   internally, avoiding full-document cloning on each viewport or selection tick.
   A separate public registry/reference accessor exposes the complete keymap
   without needing an editor instance or a valid document.
2. A shared menu presenter accepts command items and separate host-action items,
   a mounting/bounds element, anchor position, and explicit focus restoration.
   Editor commands recheck `canExecute` when activated; host actions use their own
   availability. The presenter must not know about Trilium or saving.
3. An optional context-menu request callback lets the adapter render a menu
   outside the editor subtree. The widget retains hit testing, selected-group
   preservation, active-node semantics and keyboard anchor calculation. Default
   consumers retain the existing built-in menu and user-origin execution.
4. The adapter also handles blank/unavailable-canvas requests from a focusable
   pane surface outside the inert editor. Loading, invalid and recovery states
   expose disabled editor entries plus the enabled UI toggle. Native textarea
   menus remain native. Guard against duplicate widget/pane handling.

Host chrome executes public API commands and therefore reports `origin:'api'`.
No origin API expansion is required for this feature. Keep Hide UI, help and
Documentation out of `MindMapCommand` and document history.

## Implementation sequence

### 1. Establish the widget command/shortcut registry and menu contracts

Consolidate the existing command metadata and binding definitions into the widget
registry. Make input handlers and displayed hints consume the same definitions,
including alternate redo bindings, physical Digit0 for Fit, Ctrl+Space on macOS,
dynamic checkbox presence, label editing and native clipboard behavior. Export
read-only command/keymap metadata and platform formatting through the package API.

Extract and export the registry-backed descriptors/presenter and add the optional
context-menu integration hook. Preserve the standalone widget's existing
13-item menu, targeting, keyboard behavior and disabled-item discovery.
Add host-action support, configurable return focus and mounting outside the
editor. Cover node, blank-canvas and no-selection requests without DOM hit-test
duplication in the adapter.

Checkpoint: widget keyboard/menu behavior remains compatible; a small consumer can
read the keymap without an editor, open an anchored menu and append a host action.
Run widget unit/type checks, focused real-browser keyboard/menu/focus tests and
the packaged-consumer check. Test actual expected key chords against the existing
behavior contract, not only expectations generated from the registry itself.
Update widget API
documentation and its progress/acceptance evidence with the actual contract.

### 2. Mount the working bars in Trilium

Add a stable flex layout: toolbar → notices → canvas → status bar. Keep the editor
host identity stable during selection/session updates. Adapt the reviewed SVG
paths and dimensions into scoped production components and styles.

Wire document, selection, viewport and edit events plus session/ownership changes.
Use `canUndo`/`canRedo` and command applicability rather than inferred selection
rules. Coalesce viewport display updates. Call existing save/recovery handlers;
do not persist documents from presentation subscriptions.

Implement additive ±0.10 zoom clamped to 0.25–4, percentage reset and Fit. Explicitly
mark viewport actions as interactions so they survive reopening even when the
user has not clicked the canvas. Preserve fit precision and center on resize.

Checkpoint: all wide-layout controls operate on the real editor; root/title sync,
provisional insertion, one-step undo and view memory continue to work. Verify
pointer activation while editing, including composition guards and stable button
identity between pointerdown, blur-driven rendering and click.

### 3. Add responsive More and Hide UI/Show UI

Use pane container queries at 800, 520, 440 and 320px. Drive More composition from
the same width bands and command descriptors; normalize separators after filtering.
Close menus when actual pane bounds change. Keep More available for host actions
when editor commands are unavailable.

Keep `uiHidden` in the mounted pane, independent of editor recreation and other
panes. Hide both bars and release 79px while retaining notices, view and selection.
Restore through node/blank context menus and keyboard context-menu keys, including
loading/invalid/recovery. Move focus to a valid canvas/pane target when hiding the
invoker and announce the visibility change.

Checkpoint: widths 1134, 440 and 320px work in both themes; boundary widths and
the <320px fallback preserve actions without overflow. Hidden UI remains
recoverable in every host state, and two panes retain independent settings.

### 4. Complete help, accessibility and state presentation

Implement toolbar roving focus, menu focus return, 200ms tooltips and the native
modal shortcuts dialog. Build its keymap rows from the widget's exported reference
metadata and formatter, including the “While editing a label” section and alternate
bindings. Preserve the design's section order and modal layout. Use the same
widget formatter for platform-correct tooltip labels and `aria-keyshortcuts`.
Confirm focus after resize, disabledness changes, dialog close and pane disposal;
outside interaction must not pull focus from the Trilium title or another pane.

Apply state precedence: invalid/unavailable → loading → recovery → viewer/read-only
→ label editing → empty. Failures/conflicts remain separate persistent banners,
including when read-only or UI-hidden. Copy/link/view remain usable in read-only;
recovery disables map interaction while preserving host-only actions.

Proposed Documentation default: follow the map's effective shared-editor relation,
then resolve its uniquely associated labeled add-on help note. Open it in a new
Trilium tab. Verify the navigation API against the local installation before
adding its type declaration. Report unavailable/ambiguous resolution without
choosing another installation's guide. No archive ID or title matching.
If direct parent resolution proves insufficient, consider an explicit packaged
relation with a legacy-installation fallback; a format migration is not assumed.

Checkpoint: keyboard-only flows and native text editing remain usable; both
direct and overflow help work. Test Documentation with two installations, renamed
help, missing help and existing shared-code upgrades. Verify forced colors,
reduced motion and narrow-dialog readability.
Verify that changing a binding in a test registry fixture updates its keyboard
resolution, menu/tooltip hint and keymap-reference row together, with no adapter
edit. Also assert the real default bindings independently on Mac and Windows/Linux,
including native textarea behavior, IME and host-shortcut isolation.

### 5. Verify the integrated result and document delivery

Create production screenshots matching the prototype fixture in real Trilium:
light/dark × full/split, 320px, More, shortcuts, hidden UI and recovery. Include
Classic/custom-theme fallback checks and browser/host zoom checks. Review captures
visually; prototype checks alone are not integration acceptance.

Run build, adapter/widget typechecks and unit tests, widget browser and packaged
consumer checks. Extend production browser tests for chrome and run the existing
navigation/selection, title-sync, zoom, hardening and desktop lifecycle suites.
Exercise clipboard denied/pending/stale outcomes, ownership transfer, retained
drafts, recovery races and disposal with a tooltip/menu/dialog open. Run package
and distribution checks for installed-help navigation and upgrade behavior.

Record passed/failed/not-run checks explicitly, including unavailable native
platforms and manual accessibility review. Update README and installation help to
describe bars and UI visibility. Keep widget changes and the parent submodule
reference coordinated when commits are requested. User visual acceptance remains
separate from technical verification.

## Review evidence and remaining decisions

On 2026-09-17, `node docs/design/toolbar-statusbar/verify.mjs` passed after launching
Chromium outside the filesystem sandbox. It reported no runtime errors or external
requests. Captures were regenerated under `previews/`; light-full, dark-split,
shortcuts, conflict, More and Show UI captures were visually inspected.
Production integration suites were not run for this planning task.

The relocated design handoff contains stale `design/toolbar-statusbar/...` links
and an old verification command. The command above and sibling `index.html` are
the working entry points. Its referenced `previews.html` gallery is absent;
`verify.mjs` generates PNGs only. Correct these references when maintaining the
handoff. Rebuild production CSS from the specification: the prototype contains
layered overrides and its small-screen dialog check verifies bounds, not complete
text layout or accessibility.

User decision, 2026-09-17: the widget is the sole authority for editor commands
and shortcuts, and the keymap reference must source its shortcuts from the widget.
This requires registry consolidation in step 1, beyond sharing menu descriptors.

The product preference still open at drafting is the Documentation destination;
the proposed default is the bundled installation guide. Public menu API names
and navigation API details are technical choices to resolve in their implementation
steps. The first implementation milestone is the widget registry and shared menu integration, followed
by a working toolbar/status bar in the isolated Trilium instance.
