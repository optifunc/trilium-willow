# Reproducible contributor setup

This entry point requires no existing `.test` directory, database, note IDs,
credentials or private repository access. Use synthetic notes in the isolated
instance. The [older environment report](test-trilium.md) describes historical
fixtures used by the larger integration suites; those fixtures are not shipped.

## Build and automated checks

Install Git, Node 24, Python 3 and pnpm 10.28.1, then:

```sh
git clone --recurse-submodules https://github.com/optifunc/trilium-willow.git
cd trilium-willow
pnpm install --frozen-lockfile
pnpm package
pnpm typecheck
pnpm test
pnpm test:packaging
```

For an existing clone, run `git submodule update --init --recursive` first. The
gitlink pins the widget version; do not replace it with the widget's latest branch.
No personal access token is required. `pnpm package` builds both projects and
creates the import ZIP plus standalone editor, guide and manifest in `dist/`.
Unit and packaging checks need no running Trilium or browser. Publication tests
use temporary local Git repositories and never push to GitHub.

For workflow changes, run [actionlint](https://github.com/rhysd/actionlint) from
the repository root. A1 used actionlint 1.7.12. See [A1 results](evidence/a1/report.md)
for the anonymous checkout and candidate verification, and
[Actions documentation](github-actions.md) for the manual workflows.

## Fresh Trilium desktop test — macOS ARM64

This is the exercised setup platform. Other clients remain subject to the
[compatibility table](compatibility.md). Download the official pinned
[Trilium 0.105.0 release](https://github.com/TriliumNext/Trilium/releases/tag/v0.105.0),
or use these commands from the Willow repository root:

```sh
mkdir -p .test/clean-trilium/downloads .test/clean-trilium/app
curl --fail --location --output .test/clean-trilium/downloads/trilium.zip \
  https://github.com/TriliumNext/Trilium/releases/download/v0.105.0/TriliumNotes-v0.105.0-macos-arm64.zip
printf '%s  %s\n' \
  441901c820214580c109b1e6ec8e4e9651863e7e0e5401f882a7bf120db43c2b \
  .test/clean-trilium/downloads/trilium.zip | shasum -a 256 -c -
unzip -q .test/clean-trilium/downloads/trilium.zip -d .test/clean-trilium/app
pnpm test:setup --app '.test/clean-trilium/app/Trilium Notes.app/Contents/MacOS/trilium'
```

The checksum is the release API asset digest, recorded on 2026-09-25 in
[public metadata](evidence/a1/public-metadata.json). Extract once; subsequent
test runs can reuse the downloaded app. If macOS asks for approval, use its normal
application-opening controls. Do not disable system security checks.

The launcher creates a **new** `.test/clean-trilium/run-*` directory on every run,
with separate `data/` and `profile/`, a log and `run.json`. It checks ports 37850
and 39228 are available, clears inherited `TRILIUM_*` settings, and supplies the
isolated data/profile paths explicitly. It uses the stock desktop executable,
without copying a database or installing a platform-adapted server. The loopback
debugging port is for this disposable test instance only.

1. In the native first-run window, choose a language, then **New knowledge base →
   Empty**. Do not connect to an existing server or desktop database.
2. Import `dist/trilium-willow-<version>.zip` through the tree's **Import** action.
   Retain **Safe import**. Open the imported **Willow Mind Map** template and
   the examples **Workshop ideas**, **Home reference** and **Weekend packing**,
   enabling each with **Enable render note**.
3. Outside the imported add-on subtree, create a map through **Templates → Willow
   Mind Map**. Edit with F2, add a child with Tab, commit with Enter, and wait for
   Saved. Navigate away and return to check persistence. Open **Licensing and
   notices** under the installation to inspect the MIT text.
4. Quit the app (Cmd+Q on macOS), or press Ctrl+C in the launcher terminal. Closing
   only its window can leave a macOS process running. The launcher retains the
   disposable files for inspection; the next run starts a different empty database.

Desktop first-run setup does not require reusing the old server password. Browser
access to the desktop's HTTP listener is disabled by Trilium by default; the native
window is the setup entry point. Ports and executable paths in this guide are test
settings, not promises of a globally running demo.

## Existing integration suites

`test:trilium`, `test:hardening`, `test:distribution`, and the older desktop launcher
still require the historically provisioned server, controlled Chrome session,
credentials, downloaded app and sometimes SQLite tools described in
[test-trilium.md](test-trilium.md). The fresh launcher above provides a reproducible
manual package check; it does not silently provision all those legacy fixtures.
Do not point those scripts at personal notes. Wider automation and client coverage
remain separate from this A1 setup and its recorded smoke test.
