# Developing Willow

Each map is a Render Note containing versioned JSON. It references a shared JSX
code note with the bundled editor. No host server modification is required.

## Manual desktop testing

For a fresh checkout, use [the clean desktop setup](testing.md).
The older launcher below requires already-provisioned local fixtures:

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
explained in [the environment report](test-trilium.md). Logs go to
`.test/trilium/manual-desktop.log`.

## GitHub Actions

**Build** produces a downloadable artifact with a unique version such as
`0.2.0-dev.42.1`, without changing `package.json`. **Publish** accepts a base version,
commits it when changed, builds/tests, tags the tested commit, and creates a GitHub
Release with all distribution files. Its package version includes a build number,
for example `0.3.0+build.7.1`, while its release tag is `v0.3.0`.

Both are manual. This repository and the [`mr` editor](https://github.com/optifunc/mr)
are public. Actions uses the standard GitHub token to check out the pinned public
widget commit; no custom widget secret is required.
See [workflow setup, usage, and failure recovery](github-actions.md).

## Development

Prerequisites: Git, Node 24, Python 3 and pnpm 10.28.1 (the version pinned in
`package.json`). See [reproducible setup and checks](testing.md).

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
test SQLite dependency are described in [the progress log](progress.md).

Desktop lifecycle tests use a separate `.test/trilium/lifecycle-data` database and
`lifecycle-profile`, native window close/reopen, and a loopback sync proxy. They
cover delayed/failed close-time writes and actual desktop/server conflicts.

Distribution tests create fresh server and desktop databases under
`.test/trilium/distribution/`, import the built ZIP directly in each client, and
verify activation, creation, a compatible shared-code replacement, removal/source
recovery, and reinstall. They use server ports 37848/37849 and desktop CDP 39227,
and stop their processes afterward. These test databases contain no preinstalled
Willow notes. The upgrade check covers format-v1-compatible code replacement;
it does not establish upgrades from an earlier published Willow package or document migration.

[Integration plan](trilium-integration-plan.md) ·
[Progress, evidence and limitations](progress.md)
