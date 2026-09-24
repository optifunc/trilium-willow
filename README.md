# Trilium Willow

An experimental stock-Trilium adapter for the mind-map editor in [`mr`](mr/README.md).
The usable adapter is tested on Trilium v0.105.0 in Chrome and an isolated macOS
desktop build. An installable experimental package is available locally; the
distribution lifecycle is tested on both clients. Windows desktop and Chrome
zoom isolation is covered by [the Windows test report](docs/test-windows.md).

Each map is a Render Note containing versioned JSON. All maps reference one shared
JSX code note containing the bundled editor. No server modification or widget
submodule change is required.

## Install

Download a distribution from GitHub Releases or a manual Build workflow artifact,
or build locally with `pnpm package` (requires Python 3 and the development
dependencies). Import the enclosed `trilium-willow-<version>.zip` using Trilium's native Import
action. Open the imported **Willow Mind Map** template and **Example mind map**,
and click **Enable render note** on each. Keep your own maps outside the imported
add-on subtree.

The ZIP includes the shared editor/CSS, template, example, and
[installation, update, removal and recovery instructions](docs/installation.html).
`dist/willow-editor.jsx` is the update file: replace the code in the existing
shared editor note, preserving its ID, then reload clients after saving. Importing
another ZIP creates a separate installation; it does not upgrade existing maps.
`dist/manifest.json` records versions, source commits, workflow details, artifact
hashes, and the tested Trilium version.

Without the add-on, maps retain their JSON and open in Trilium's Render Note setup
screen. **Note source** still exposes the document. After reinstalling, reconnect
old maps as described in the installation instructions.

## Try the development instance

The test instance is at http://127.0.0.1:37841/. Right-click a note in the tree,
choose **Insert note after** or **Insert child note**, then **Willow Mind Map**
under Templates. Enter the title in Trilium's normal title field. The map root
follows the title; editing the root also renames the note. On first opening a
map with different values, the Trilium title replaces the root text. Native title
typing updates the root after leaving the title field. The test
password and server instructions are in [the environment report](docs/test-trilium.md).

Edit a selected node with F2, commit with Enter, and insert a child with Tab.
Maps autosave committed changes. Fit the map with **Cmd/Ctrl+Shift+0**.
When a map is open twice, the viewer offers **Edit here** to transfer editing.
The toolbar provides editing commands; **More** contains commands that do not fit.
The status bar provides zoom, reset and Fit. Willow’s 100% uses the original
map geometry at 143% scale, keeping all proportions intact. Reset returns to
this size; buttons step by 10 percentage points within 25–400%. Modifier+wheel
zooms by one percentage point per event on every platform. Existing saved
views retain their actual size, except values below the new minimum are clamped. Open **Keyboard shortcuts** for the
complete reference, sourced directly from the widget. **Documentation** opens this
installation’s bundled guide in a new tab.

Choose **Hide UI** from More or the map context menu to hide both bars in all Willow maps.
Right-click the canvas or press Shift+F10 and choose **Show UI** to restore them.
This preference is stored once on the Trilium root note as the non-inheritable
`willowUiHidden` label and follows Trilium sync across devices.
Notices remain visible and the map’s position is preserved. Links show **Cmd+click to open** on macOS
and **Ctrl+click to open** elsewhere after one second of hovering over the node.
Leaving hides the hint; every re-entry starts a fresh one-second delay.
Copied outlines have no final newline.

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

Recovery is coordinated across panes, including refreshes. A newer draft or
unfinished edit invalidates a pending recovery result instead of being discarded.
On desktop, closing with unfinished work commits the label and starts saving; the first close
is blocked while saving or recovery is pending. Retry closing after the header
shows Saved, or use Retry save after a failed write.

Native subtree export/import preserves map JSON. Exporting only a map omits its
relation to the shared editor outside the archive; reattach `~renderNote` to the
installed Willow editor to render that imported map. Dedicated map export remains
deferred.

## Manual desktop testing

Run from this repository (macOS arm64 or Windows x64 test installation):

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

## GitHub Actions

**Build** produces a downloadable artifact with a unique version such as
`0.2.0-dev.42.1`, without changing `package.json`. **Publish** accepts a base version,
commits it when changed, builds/tests, tags the tested commit, and creates a GitHub
Release with all distribution files. Its package version includes a build number,
for example `0.3.0+build.7.1`, while its release tag is `v0.3.0`.

Both are manual. This repository and the [`mr` editor](https://github.com/optifunc/mr)
are public. The current workflows still explicitly require the **`MR_READ_TOKEN`**
Actions secret with read-only Contents access to `optifunc/mr`; this is a legacy
workflow requirement, not a restriction on downloading or building the source.
See [workflow setup, usage, and failure recovery](docs/github-actions.md).

## Development

```sh
git clone --recurse-submodules https://github.com/optifunc/trilium-willow.git
cd trilium-willow
pnpm install --frozen-lockfile
pnpm build
pnpm package
pnpm typecheck
pnpm test
pnpm test:packaging
```

For an existing clone, run `git submodule update --init --recursive` before
installing dependencies. The public `mr` submodule needs no special access token
for a local checkout.

The build produces `dist/willow-spike.js` for a Trilium Code note with JSX MIME
type. It includes the widget/CSS and imports Preact from Trilium itself.

With the isolated test server and its Chrome CDP session running:

```sh
pnpm spike:deploy
pnpm test:trilium
pnpm test:hardening
pnpm spike:test:desktop
pnpm test:desktop:lifecycle
pnpm test:distribution
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

Desktop lifecycle tests use a separate `.test/trilium/lifecycle-data` database and
`lifecycle-profile`, native window close/reopen, and a loopback sync proxy. They
cover delayed/failed close-time writes and actual desktop/server conflicts.

Distribution tests create fresh server and desktop databases under
`.test/trilium/distribution/`, import the built ZIP directly in each client, and
verify activation, creation, a compatible shared-code replacement, removal/source
recovery, and reinstall. They use server ports 37848/37849 and desktop CDP 39227,
and stop their processes afterward. These test databases contain no preinstalled
Willow notes. The upgrade check covers format-v1-compatible code replacement;
there is no older published Willow package or document migration in this release.

[Integration plan](docs/trilium-integration-plan.md) ·
[Progress, evidence and limitations](docs/progress.md)
