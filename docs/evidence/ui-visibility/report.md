# Shared UI visibility

Verified 2026-09-21 against the isolated Trilium v0.105.0 server/browser.
Bundle SHA-256: `9a039f32be3fd1ce0600ecc2f49f6da5562009e09f4560ca425108a5fbd3c898`.

The adapter persists `willowUiHidden` as one non-inheritable root-note label.
All maps and imported installations share it. Native attribute events update
open clients; the label uses Trilium’s normal attribute synchronization.
No map-content or widget-command changes are involved.

Validation:

- `pnpm typecheck`, `pnpm test` (66 tests), and `pnpm build` passed.
- `pnpm test:ui-visibility` passed all five groups; see [browser.json](browser.json).
  Covers different installations and maps, a second browser window, reload,
  reopening after all maps close, native title focus, failed-write retry and
  error dismissal, deleted/invalid labels, and unchanged map bytes.
- `pnpm test:chrome` passed all 14 chrome/lifecycle groups, including viewport
  retention, shared visibility across editing ownership transfer, read-only
  editor recreation, and restoration in invalid/recovery states.

The focused check restores the original root preference and removes its
temporary installation. No desktop or device-to-device sync run was performed
for this change; cross-window updates were verified on the same server.
