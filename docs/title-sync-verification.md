# Title synchronization and widget follow-up — 2026-09-14

Tested working tree based on parent `0309cfc` and widget `7c53c4b`, with stock
Trilium 0.105.0 on macOS arm64. Changes are uncommitted.

## Behavior

The title wins on first writable opening of a differing map. Thereafter committed
root edits and native title edits synchronize in both directions. Native title
entry is applied after leaving the field, including keyboard note navigation;
root edits retain the normal autosave debounce. Child-only changes do not rename
the note. Full map validation precedes initial alignment.

The shared session tracks pending title writes alongside content. Failed title
writes remain retryable after content succeeds. Detected concurrent title changes
preserve the draft for explicit recovery. Content recovery keeps the selected
incoming root; title-conflict recovery applies the incoming title. Recovery copies
use the copied root as their title to avoid changing it when opened.

Trilium has separate title and content endpoints, without an atomic combined write
or compare-and-swap. The integration retains its existing last-read/write race
limit. A process exit between requests can leave a mismatch, which takes the
stored title at the next fresh opening. No durable pending-title journal was added.

Links show the platform modifier hint. Copied outlines have no final newline;
empty labels use `\e`, with literal backslashes escaped. Historical paste inputs
with a terminating newline still work. Widget evidence and reproduction commands
are in [the widget report](../mr/docs/evidence/milestone-d/link-clipboard/report.md).

## Verification

- Build and both typechecks passed; 46 adapter and 178 widget unit tests passed.
  New session tests cover deferred title entry, initial focused template loading,
  failed title retry, undo, child-only edits, concurrent renames, recovery,
  cancellation, read-only/invalid maps and a newer root during acknowledgement.
- Widget clipboard and link tests: 94 passed in Chromium, Firefox and WebKit;
  two existing non-Chromium Clipboard API permission skips. Tooltip platform
  routing used navigator overrides; this does not claim Windows/Linux OS runs.
- Browser editing suite: all ten groups passed, including editing, undo/redo,
  note switching, refresh, split ownership, tab close and malformed source.
- Browser vertical slice: all eight groups passed, including native creation,
  stable view restoration, failed save plus title rename, Keep both and discard.
  Navigation, selection/focus and four delayed-recovery/view regressions passed.
- Native macOS desktop suite passed creation, editing, reload, clipboard, views,
  navigation, selection/focus and delayed recovery. Inspected its screenshot:
  native title and root match; the final panned view intentionally extends beyond
  the viewport. No selection colour or layout style was changed.
- Focused title checks run on both browser and native desktop: initial alignment,
  native typing, keyboard title navigation, root edit/undo, reload, failed title
  retry and native template creation.

The additional keyboard-title navigation check was added after the broader suites;
its focused browser and desktop reruns cover the final flush change. The complete
release matrix (including offline desktop/server sync and graceful-window-close
fault injection) was not rerun for this follow-up. Earlier evidence remains history,
not a claim that those gates ran on this working tree.

## Reproduce

With the isolated test server and CDP browser running:

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm --dir mr typecheck
pnpm --dir mr test
pnpm spike:deploy
pnpm test:trilium
node scripts/test-review-regressions.mjs
pnpm test:title
pnpm test:title:desktop
pnpm spike:test:desktop
```

Run browser mutations and desktop snapshots sequentially. Desktop commands use
`.test/trilium/desktop-data` and `desktop-profile`, leaving personal data untouched.
The focused desktop command launches and closes the isolated app automatically.

[Recorded run summaries](evidence/title-sync/results.json) contain the tested bundle
hashes. Full local evidence remains under `.test/trilium/evidence/` (ignored).
