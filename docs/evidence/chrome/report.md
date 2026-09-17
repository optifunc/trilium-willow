# Willow toolbar and status bar

Implemented design revision 6 in the Trilium adapter on 2026-09-17. The widget
submodule remains at `3c920a0`; command behavior, applicability, menu descriptors,
shortcut tooltips, accessibility hints and the complete shortcut reference use its
public registry APIs. Status zoom buttons deliberately use additive 0.10 steps;
keyboard zoom retains the widget's multiplicative behavior.

The adapter owns stable button DOM, responsive layout, the pane-local visibility
flag, modal and documentation navigation. Menus mount outside the inert canvas.
View memory records explicit toolbar interaction and preserves the world-space
center through bar visibility and pane-size changes. No chrome state enters map
JSON, undo history or document-saving subscriptions.

## Verification

- Production build and package, both TypeScript checks, 60 adapter unit tests,
  184 widget unit tests and six Python packaging tests passed.
- `node scripts/test-chrome.mjs` passed its ten integration groups in the isolated
  Trilium 0.105 browser. See [results](browser.json). Covers stable blur/click
  behavior, one-step insertion undo, composition guard, all width boundaries
  from 1134 to 240px, More focus/toggling, view retention, reference equality for
  every widget binding, 200ms tooltip timing/position, recovery/invalid fallback
  and real public-API navigation to a renamed installation guide.
- `node scripts/test-chrome-lifecycle.mjs` passed all four groups: hidden state
  survives read-only recreation, two panes retain independent visibility through
  ownership transfer, the narrow modal has one column without overflow, and
  disposal closes a live modal. Forced-colors/reduced-motion media emulation
  preserved modal operation. See [lifecycle results](lifecycle.json).
- `pnpm test:trilium`, `pnpm test:zoom`, and `pnpm test:title` passed: native
  creation, save echoes, unfinished edits on navigation, disposal, two-pane
  ownership, view/selection memory, detected-conflict recovery, native title focus,
  map-only keyboard/wheel zoom and root/title synchronization.
- Recovery chrome in the dedicated suite uses an injected session recovery flag;
  actual conflict and failed/retried recovery operations are covered by the
  vertical-slice suite. Missing and ambiguous guides, including two installation
  graphs, also have unit coverage. The browser uses a renamed, separately created
  installation and the actual Trilium navigation API.
- Persistence, native host/theme/clipboard/export-import, native server sync and
  delayed-recovery regression scripts passed individually. Distribution import,
  shared-code upgrade, removal and reconnect passed in both browser and macOS
  desktop. The macOS desktop lifecycle suite also passed delayed/failed-write
  close/reopen, draft recovery, offline reconnect and competing acknowledged
  versions. Its final cleanup now waits for the coordinated title save, just as
  the production close guard requires. See [regression results](regressions.json).
- Widget three-engine menu/input and installed-package checks passed at the
  preceding registry milestone; see its [report](../../../mr/docs/evidence/command-registry/report.md).
  They were not repeated for these adapter-only changes.

## Visual review

Reviewed production captures of the 19-node Field guide fixture:
[full toolbar](light-full.png), [dark variables at 320px](dark-320.png),
[More](more.png), and [shortcut dialog](shortcuts.png). The isolated run also retains
440px captures, hidden UI and recovery under `.test/trilium/evidence/chrome/`.
Dark captures override Trilium's theme variables on the real pane; they are a
custom-theme fallback check, not acceptance of every installed Trilium theme.
The host suite also exercised native Next Light and Next Dark; its native dark
capture was visually reviewed with a live label edit and the new bars.
Narrow maps retain their current center/zoom and can clip naturally until Fit is
requested, as required by view retention.

## Fixes found during testing

Documentation initially created the correct guide tab but Trilium's bubbling
click handler reactivated the original map. An activation trace confirmed the
order. Navigation now starts in the following task, after native click handling;
the browser check asserts that the guide becomes the active tab.

Test setup was corrected to await coalesced viewport rendering and resize after
hiding bars, avoid clicking an already-fitted disabled Fit action, use the session's
actual recovery flag, and keep the capture pane within its native parent's bounds.
The older vertical-slice assertion requiring no toolbar was replaced with a check
for the mounted toolbar and an enabled Add child action.

The first hardening run reached native revision restoration, then raced its
root-to-title save against the next offline-write scenario. The test now waits for
Saved and the restored title before intercepting subsequent writes. A separate
startup race showed a blank native render surface before fixture navigation; the
test now opens and waits for its known initial map explicitly. The native-import
check now retries only the execution-context interruption caused by Trilium’s
import-triggered reload. The sync fixture now gives its root and title the same
initial value and waits for coordinated title saves on both sending and receiving
panes before beginning the next scenario; the previous fixture predated title
synchronization. These corrections retain the original persistence assertions.

## Remaining acceptance

User visual approval, screen-reader/manual accessibility review, native Windows/Linux
chrome coverage and the complete installed-theme matrix remain separate from this browser implementation checkpoint.
