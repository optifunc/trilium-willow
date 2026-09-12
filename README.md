# Trilium Willow

An experimental stock-Trilium adapter for the mind-map editor in [`mr`](mr/README.md).
The first integration spike is verified on Trilium v0.105.0 in Chrome and an
isolated macOS desktop build. This is not a finished distributable add-on.

Each map is a Render Note containing versioned JSON. All maps reference one shared
JSX code note containing the bundled editor. No server modification or widget
submodule change is required.

## Try the spike

The test instance is at http://127.0.0.1:37841/. Open **Willow integration spike →
Willow Map A** or **Willow Map B**. The test password and server instructions are
in [the environment report](docs/test-trilium.md).

Edit a selected node with F2, commit with Enter, and insert a child with Tab.
Maps autosave committed changes. Use **Fit map** in a narrow pane. When a map is
open twice, **Edit in this pane** transfers editing to its viewer.

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
pnpm spike:test
pnpm spike:test:desktop
```

These are local spike tools, not production installers. Deployment updates the
bundle while retaining maps. Browser tests deliberately reset the two disposable
maps. Desktop tests refresh a separate database from a consistent backup of the
test server and close the isolated app afterward. The downloaded desktop app and
test SQLite dependency are described in [the progress log](docs/progress.md).

[Integration plan](docs/trilium-integration-plan.md) ·
[Spike findings, evidence and limitations](docs/progress.md)
