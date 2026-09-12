# Trilium Willow

An experimental stock-Trilium adapter for the mind-map editor in [`mr`](mr/README.md).
The usable adapter is tested on Trilium v0.105.0 in Chrome and an isolated macOS
desktop build. Packaging and further persistence hardening remain pending.

Each map is a Render Note containing versioned JSON. All maps reference one shared
JSX code note containing the bundled editor. No server modification or widget
submodule change is required.

## Try the adapter

The test instance is at http://127.0.0.1:37841/. Open **Willow integration spike →
Willow Map A**, **Willow Map B**, or **Create a Willow mind map**. The creation
page adds a sibling map and initializes its root from the entered title. Existing
maps also offer **New map**. The test password and server instructions are
in [the environment report](docs/test-trilium.md).

Edit a selected node with F2, commit with Enter, and insert a child with Tab.
Maps autosave committed changes. Use **Fit map** in a narrow pane. When a map is
open twice, **Edit in this pane** transfers editing to its viewer.

New maps open with the root centred at 100% zoom. Position and zoom are remembered
locally per document and browser/desktop profile; split panes keep independent
views. Panning does not modify note content.

The toolbar distinguishes unsaved, saving, saved, and failed saves. **Retry save**
retains the draft after a failure. For a detected external change, **Keep both**
saves local work as a sibling recovery map before loading the saved original;
**Use incoming** asks before discarding local work. Drafts stay in memory through
pane changes, but do not survive an abrupt process loss. Cross-device edits can
still race. Invalid documents offer their original source and a reload action.

## Development

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

The build produces `dist/willow-spike.js` for a Trilium Code note with JSX MIME
type. It includes the widget/CSS and imports Preact from Trilium itself.

With the isolated test server and its Chrome CDP session running:

```sh
pnpm spike:deploy
pnpm test:trilium
pnpm spike:test:desktop
node scripts/test-restart.mjs
```

These tools target the isolated test installation. The restart check verifies the
server PID and directory before stopping and restarting it. Deployment updates the
bundle while retaining maps. Browser tests deliberately reset the two disposable
maps. Desktop tests refresh a separate database from a consistent backup of the
test server and close the isolated app afterward. The downloaded desktop app and
test SQLite dependency are described in [the progress log](docs/progress.md).

[Integration plan](docs/trilium-integration-plan.md) ·
[Progress, evidence and limitations](docs/progress.md)
