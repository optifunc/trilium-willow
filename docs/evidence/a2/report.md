# A2 — positioning, examples and workflow

Recorded 2026-09-25. This is implementation and agent-operated verification evidence,
not a user study or a published release.

## Scope and revision

The user approved A2 after review of its scope. The parent baseline was
`02d97489847fcadadd891a24eb6172f6dc2bf3ff`, with clean widget pin
`c94ea6efb7e08da1bec188fb447c96a3c34cd879`. A2 changes the parent working tree;
the editor source and widget pin are unchanged. Windows and macOS remain supported.
The MIT license selected in A1 remains in both projects and distribution artifacts.

- [README](../../../README.md): user promise, screenshot, use cases, prerequisite,
  install/first edit, native comparison, boundaries and support.
- [Canonical examples](../../../examples/maps.json): one source for package input,
  screenshot content and workflow starting state. The archive contains three render
  notes with correctly remapped shared-editor relations.
- [Workflow](../../demo.md), [examples](../../examples.md) and
  [comparison](../../comparison.md): actual supported product and synthetic data.
- [Audience introductions](../../audiences.md) and [distribution copy](../../release-copy.md):
  prepared locally, not sent or applied remotely.
- [Development](../../development.md) and [usage](../../usage.md): detailed material
  moved out of the README's first-use path.

## Capture and interaction verification

[capture.json](capture.json) identifies the exact local artifact hashes, Trilium
version, browser, pane sizes and demonstrated actions. The package is a local
candidate with base version 0.2.1, not a replacement for published v0.2.1 assets.

The harness creates a new empty database under `.test/a2/run-*`, binds only to
loopback port 37851, clears inherited Trilium environment settings and stops its
server/browser on exit. It uses Trilium's real first-run setup and native import
dialog with **Safe import** retained, then activates the template and each example.
All three saved documents are compared against the canonical source and checked
again after reload. No personal knowledge base is used.

The native comparison fixture is built from the exact workshop tree through the
host API; its stored hierarchy is checked and all 28 labels must render. A native
Tab/Enter child edit is also exercised. Both editors share the same pane dimensions.
Willow Fit and native Center/Zoom out controls make the full hierarchy visible.
Native defaults are retained apart from selecting the two-sided layout. The
fixture conversion is test setup, not a new product import feature.

The video records real mouse/keyboard operations in Willow, with a presentation
caption overlay added only to the capture page. Shortcut labels come from the
widget action registry. It covers creation, nesting, subtree reordering, adding
and checking a checkbox, folding, navigating to another map, expanding reference
details and returning. Assertions check the moved subtree, checked state, folded
branch and exact saved content on return. ffmpeg trims setup time and encodes an
MP4 and GIF; screenshots are captured directly from the app.

Captures use Chrome on macOS and Trilium 0.105.0. The local server uses the
[documented macOS adaptation](../../test-trilium.md) of official server assets;
it is not an official macOS server distribution. The media and selected frames
were visually reviewed for legibility, complete content and matching actions.

## Reproduce

Requires the checked-out widget, installed dependencies, an already provisioned
Trilium 0.105.0 server, Chrome, and ffmpeg on PATH. This capture harness does not
download the server; see [the environment report](../../test-trilium.md) for its
provisioning details. It generates only disposable databases and synthetic notes.

```sh
pnpm package
pnpm typecheck
pnpm test
pnpm test:packaging
node scripts/capture-adoption.mjs
```

The default server directory is `.test/trilium/server`; set
`WILLOW_CAPTURE_SERVER` to an isolated server installation if needed. Port 37851
must be free. Media goes to `docs/media/` and the capture result replaces
`docs/evidence/a2/capture.json`. A failed run retains local logs and a failure
screenshot under its `.test/a2/run-*` directory.

## Validation and limits

Build/package, adapter typecheck, 68 adapter unit tests and six packaging/publication
tests pass. Packaging checks compare all three archived example documents and
render-note metadata against the canonical source. The capture checks pass with
no browser page errors. Native Safe import, activation, reload and the recorded
workflow are verified against the generated package.

The [distribution run](distribution.json) passes all five checks in each of Chrome
and the official native macOS desktop app: import/activation of all three examples,
template creation and saved reload, compatible shared-code replacement, removal
with external map JSON preserved, and reinstall/reconnection. This uses disposable
databases and the existing `scripts/test-distribution.mjs`, with a temporary Chrome
CDP session on port 39222. The replacement fixture is format-v1-compatible code,
not an upgrade from a downloaded previous release. Logs:
[build](build.txt), [typecheck/unit/packaging](checks.txt),
[browser/desktop distribution](distribution.txt).

Final [artifact review](artifact-review.json) verifies local documentation targets
and anchors and records media hashes. Distribution files match their manifest;
the MP4 is 32.88 seconds and the GIF decodes successfully. Source diff whitespace
and both changed JavaScript harnesses' syntax checks pass.

Initial capture attempts exposed a harness timing issue when expanding import
options after file selection, and the native editor's initially empty stored
content. The harness now opens options before selecting the file and performs a
real native edit before reading its initial document. These were capture setup
corrections; no product runtime change was needed. A later capture opened a duplicate
map tab and correctly encountered Willow's single-editor ownership guard. Capture
setup now closes its earlier browser context and selects the map through the note
tree, instead of opening another map tab through a URL.

No new Windows device run, mobile support, cross-device sync trial or independent
human usability trial is claimed. Windows support includes the owner's daily-use
confirmation, as recorded in [compatibility](../../compatibility.md). Earlier A1
and runtime evidence retain their original dates and scope. Published-package
upgrades and document migrations are not established by this work.

## Publication status

[Public metadata](public-metadata.json) was read anonymously on 2026-09-25. The
repository had no description/topics and latest release v0.2.1 contained the
earlier small example. New examples/media are explicitly marked as source-build
material prepared for the next release. No remote metadata, release assets or
community messages were changed. At evidence capture, no commit, push or release
had been performed. The owner subsequently authorized committing A2 locally.
