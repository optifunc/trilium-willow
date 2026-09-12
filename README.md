# Trilium Willow

An experimental stock-Trilium adapter for the mind-map editor in [`mr`](mr/README.md).
The usable adapter is tested on Trilium v0.105.0 in Chrome and an isolated macOS
desktop build. The first persistence/host-hardening pass is complete; packaging is next.

Each map is a Render Note containing versioned JSON. All maps reference one shared
JSX code note containing the bundled editor. No server modification or widget
submodule change is required.

## Try the adapter

The test instance is at http://127.0.0.1:37841/. Right-click a note in the tree,
choose **Insert note after** or **Insert child note**, then **Willow Mind Map**
under Templates. Enter the title in Trilium's normal title field. The map root
starts as **Mind map** and is edited independently from the note title. The test
password and server instructions are in [the environment report](docs/test-trilium.md).

Edit a selected node with F2, commit with Enter, and insert a child with Tab.
Maps autosave committed changes. Fit the map with **Cmd/Ctrl+Shift+0**.
When a map is open twice, the viewer offers **Edit here** to transfer editing.
There is no permanent add-on toolbar.

New maps open with the root centred at 100% zoom. Position, zoom, selected nodes,
and the active node are remembered locally per document and browser/desktop
profile; split panes keep independent views. These changes do not modify note
content. Saved selections ignore deleted or hidden nodes, falling back to the root.

Click a Willow note in the left tree to focus its map, then use arrow keys to
navigate the selection. A newer click or focus change while the map loads takes
precedence, so editing the native note title retains focus.

Trilium’s note-header indicator reports map saving state. **Retry save**
retains the draft after a failure. For a detected external change, **Keep both**
saves local work as a sibling recovery map before loading the saved original;
**Use incoming** asks before discarding local work. Drafts stay in memory through
pane changes, but do not survive an abrupt process loss. Cross-device edits can
still race. Actual offline-sync tests confirm that Trilium picks one version when
both databases have already acknowledged competing edits. Invalid documents offer
their original source and a reload action.

Native subtree export/import preserves map JSON. Exporting only a map omits its
relation to the shared editor outside the archive; reattach `~renderNote` to the
installed Willow editor to render that imported map. Dedicated map export remains
deferred.

## Manual desktop testing

Run from this repository:

```sh
pnpm dev:desktop
# Or: node scripts/run-desktop.mjs
```

This builds the current adapter and opens the downloaded Trilium desktop app.
On first run it copies the isolated server database into
`.test/trilium/manual-desktop-data`; later runs preserve your manual test maps
and update only the shared editor bundle. The app stays open until you quit it
or press Ctrl+C in the terminal. Use `--no-build` to open the existing build.

The launcher uses `.test/trilium/manual-desktop-profile`, server port 37843,
and debug port 39224. It is separate from your personal Trilium and from the
automated desktop tests. The downloaded test app, initialized server database,
`pnpm` dependencies, and test SQLite dependency must already be installed as
explained in [the environment report](docs/test-trilium.md). Logs go to
`.test/trilium/manual-desktop.log`.

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
pnpm test:hardening
pnpm spike:test:desktop
node scripts/test-restart.mjs
```

These tools target the isolated test installation. The restart check verifies the
server PID and directory before stopping and restarting it. Deployment updates the
bundle while retaining maps. Browser tests deliberately reset the two disposable
maps. Desktop tests refresh a separate database from a consistent backup of the
test server and close the isolated app afterward. Hardening tests use disposable
maps and independent browser contexts; they briefly switch the test theme and
exercise protected-session login/logout. The sync test starts a separate database
under `.test/trilium/sync-data` on port 37844 and a loopback proxy on 37845, then
stops both. No external sync service is involved. The downloaded desktop app and
test SQLite dependency are described in [the progress log](docs/progress.md).

[Integration plan](docs/trilium-integration-plan.md) ·
[Progress, evidence and limitations](docs/progress.md)
