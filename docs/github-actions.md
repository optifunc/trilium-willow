# Manual builds and releases

Two manually dispatched workflows share `.github/actions/build-distribution`.
They run on Ubuntu 24.04 with Node 24 and Python 3, install the pnpm version pinned
in `package.json` and frozen workspace dependencies, build the distribution,
typecheck, and run adapter and packaging/publication tests. They do not run the
Trilium browser/desktop integration suites, which require the isolated local test
installations.

## One-time setup

The workflows must be committed and pushed to the default branch to appear in
GitHub's Actions menu. Both this repository and
[`optifunc/mr`](https://github.com/optifunc/mr) are public; local source checkout
does not require a personal access token.

The current composite action still rejects an empty `widget-token` input, and
both workflows supply it from **`MR_READ_TOKEN`**. Until that legacy requirement
is removed from the workflows, configure an Actions repository secret with that name in
`optifunc/trilium-willow`: a fine-grained personal access token restricted to
`optifunc/mr` with **Contents: Read-only**. This requirement comes from the workflow
implementation, not repository visibility. The widget token is used only for
checkout and is not persisted in Git configuration.

Build uses read-only repository permissions. Publish requests `contents: write`
for the version commit, tag, and GitHub Release, using the normal `GITHUB_TOKEN`.
The default branch was unprotected when these workflows were implemented. If
branch or tag rules are introduced later, they must permit this publishing path;
the workflow does not force-push or bypass those rules.

## Build

In **Actions → Build → Run workflow**, select a branch or tag. No version input
is needed. The workflow checks out that dispatch's exact commit and the `mr`
commit recorded in its gitlink, then derives a version from `package.json`:

```text
package.json: 0.2.0
run 42, attempt 1: 0.2.0-dev.42.1
run 43, attempt 1: 0.2.0-dev.43.1
run 43, attempt 2: 0.2.0-dev.43.2
```

Build never modifies or commits `package.json`. Download the workflow's
`trilium-willow-<version>` artifact from the run page. Extract that outer Actions
archive, then import the enclosed `trilium-willow-<version>.zip` into Trilium.
Artifacts are retained for 30 days, subject to repository retention limits.

## Publish

In **Actions → Publish → Run workflow**, select the default branch and enter a
plain version such as **`0.3.0`**, without `v`, a prerelease suffix, or build
metadata. Versions must be at least the current package version; reusing an
existing release tag is rejected. The workflow:

1. Validates the input and rejects an existing tag or a branch that has moved
   since dispatch. Updates `package.json` and commits the base version locally
   when it differs. If publishing the current base version for the first time,
   the existing commit is used.
2. Builds and tests that exact commit with a full package version such as
   `0.3.0+build.7.1`. Only `0.3.0` is stored in `package.json`.
3. Uploads the tested files as an Actions artifact, then pushes the commit and
   annotated tag `v0.3.0` together using an atomic, non-forced Git push. If the
   branch moves during the build, the push fails without publishing the tag.
4. Creates a draft GitHub Release, attaches the files, and publishes the draft
   only after upload succeeds.

Publish runs are serialized. Build and Publish have separate run counters; both
include the attempt number so reruns have distinct package versions. Build-number
generation does not create commits. There is no automated push/tag trigger and
no automatic release when ordinary code is pushed.

The package ZIP, `willow-editor.jsx`, `installation.html`, and `manifest.json` are
attached both to the run artifact and the GitHub Release. The manifest records
the full/base versions, checksums, built repository commit, actual `mr` commit,
source dirty flag, and workflow name, repository, run ID/number, attempt, and URL.
The built commit can differ from the dispatch commit because Publish may create
a version commit. Packaging reads Git HEAD rather than assuming `GITHUB_SHA` is
the final source commit.

## Failure and retry

A failed build leaves the remote version and tag unchanged. Start a new dispatch
if the branch has moved. After a successful push, rerunning Publish for that
version is deliberately rejected: it never moves an existing tag or replaces
release assets with a different build.

If GitHub release creation/upload fails after tagging, recover using the tested
Actions artifact from that same run. Check its manifest commit against the tag,
create or open the corresponding draft release, attach any missing files from
that artifact, and publish it after all four files are present. Do not rebuild
and overwrite the tagged release. A published release is left untouched; use a
new version for corrected code or assets.

## Local validation

```sh
pnpm package
pnpm typecheck
pnpm test
pnpm test:packaging
```

The packaging tests use temporary repositories and local bare remotes to exercise
version updates, build-number uniqueness, invalid input, metadata/checksums,
duplicate-tag rejection, and an atomic-push race. They never publish to GitHub.
For a local package with a generated version:

```sh
WILLOW_VERSION=0.2.0-dev.42.1 pnpm package
```

Local manifests have `workflow: null` and record whether the source is dirty.
Artifact filenames, installed version labels, and manifests receive the override;
`package.json` does not change.

References: [manual dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
[workflow run/attempt context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#github-context),
[multiple-repository checkout](https://github.com/actions/checkout#checkout-multiple-repos-side-by-side),
[release creation](https://cli.github.com/manual/gh_release_create), and
[publishing a draft](https://cli.github.com/manual/gh_release_edit).
