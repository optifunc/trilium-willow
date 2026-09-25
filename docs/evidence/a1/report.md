# A1 — public baseline, CI, licensing and test setup

Date: 2026-09-25. Status: implemented and locally verified; publication pending.
Willow baseline `b480c6e4918afb4a66efe00a0ee98a718efea9eb`; widget baseline
`c8f363d06fc92c199ee7603491977ab1368456db`, both with the A1 working-tree changes.
Environment: macOS 26.7 (25G229), Apple M2 / ARM64, Node 24.2.0,
pnpm 10.28.1, Python 3.9.6. Exact desktop runtime is in the smoke result.

## Delivered

- [Compatibility and dated host/API facts](../../compatibility.md), backed by
  [anonymous public metadata](public-metadata.json) and durable integration reports.
  Windows support is owner-confirmed through daily use; its missing historical
  automated report is identified separately. Historical local-only paths
  are labelled rather than linked as public reports. Fixed relative design/source links.
- CI removes the custom widget-token input, environment check and secret wiring.
  The existing gitlink lookup, pinned checkout action, exact widget checkout,
  read-only Build permissions and publication safeguards remain intact. The
  [pinned checkout documentation](https://github.com/actions/checkout/blob/d23441a48e516b6c34aea4fa41551a30e30af803/README.md#checkout-multiple-repos-side-by-side)
  supports public secondary repositories with the default token; private-repository
  PAT instructions do not apply here.
- MIT selected by the owner for both projects and their artifacts. License files,
  package metadata, ZIP notice note, standalone editor/guide notices and widget
  JavaScript/package notices are implemented. [Dependency audit](../../licensing.md).
- [Fresh contributor setup](../../testing.md) builds from public sources and opens
  the official desktop app with a new isolated database/profile. The historical
  server setup is labelled separately. No pre-existing database or password is needed.

## Verification

| Check | Result |
| --- | --- |
| Anonymous recursive public clone | Passed at the baseline revisions with system/global Git config disabled, credential helper empty and prompts disabled |
| Fresh public dependency install | Passed, frozen lockfile and a new pnpm store; no widget token |
| Unchanged public source | Package/build, adapter typecheck, 68 unit tests and 6 packaging/publication tests passed; [log](public-build.txt) |
| Candidate overlaid onto that public clone | Build/package, adapter typecheck, 68 unit tests and 6 packaging/publication tests passed; [log](candidate-build.txt). Frozen offline reinstall passed using the freshly populated store |
| Widget | Build, typecheck and [195 unit tests](widget-checks.txt) passed; packed tarball has MIT metadata, full license and retained JS notice; reference screenshots excluded |
| Workflow syntax | actionlint 1.7.12 passed both workflows; the composite steps also passed when wrapped in a temporary workflow. Download verified against the official release checksum |
| Publication regression checks | Existing local-bare-repository duplicate-tag and atomic-push-race checks passed; no GitHub workflow was dispatched |
| Packaging notices | Full parent/widget licenses present in ZIP notice and editor; standalone HTML guide notice and manifest hashes checked |
| Native first-run/package smoke | Passed on official Trilium 0.105.0 ARM64 desktop with fresh empty database/profile; [result](clean-desktop.json), [screenshot](clean-desktop.png) |
| Setup guard | An occupied port is rejected without creating another database; the final isolated process was stopped after verification |
| Documentation | 273 local Markdown/HTML link targets and diff whitespace checked; current upstream links checked against official sources |

The native smoke used actual UI controls for language selection, empty knowledge
base setup, file selection/import, activation and template creation, followed by
keyboard editing and save/reload. The template correctly displays creation
instructions; the example and newly created map render the editor. The imported
license note is readable. The result records the exact candidate ZIP digest and
manifest, not a guessed release version. Its synthetic map screenshot was inspected.

Initial smoke probes had incorrect assumptions about template rendering, button
accessible names and map focus; the completed run uses the existing template
contract and canvas focus path. The first widget artifact check caught a stripped
license banner; legal-comment retention was corrected and the packed archive was
checked again. These were resolved during implementation. There are no outstanding
failures in the checks above.

## Reproduction and limits

Use [testing.md](../../testing.md) for the public build and clean native test.
Private notes, the user's personal database/profile and the historical server's
credentials were not needed. Temporary clone/install files and disposable runtime data stay in ignored
`.test/a1/` and `.test/clean-trilium/`. Selected build/test logs above, this report,
metadata and the smoke result are the durable evidence. The cached official macOS archive was verified against the release checksum
recorded in public metadata. At the original A1 verification, local, isolated-clone and native-imported
artifact hashes matched. The support-wording follow-up below updates the guide.

Not run: hosted GitHub Actions, native Windows/Linux, Safari/Firefox host checks,
real phones, the full historical browser/desktop regression matrix, cross-version
upgrades, accessibility/user acceptance and human onboarding trials. A1 does not
implement A2–A9 or claim those results. Process termination after the smoke is
cleanup, not native close/lifecycle evidence.

MIT is resolved locally; support beyond the evidence remains unverified. Both
repositories are dirty with task-related changes. The widget gitlink remains at
`c8f363d`: commit/push the widget licensing changes first, then update the parent
pin before publishing a parent release. No commits, pushes, releases, remote
metadata updates or outreach were performed. Next actionable task: review these
changes, then A2 positioning/examples when assigned.

## Owner support clarification — 2026-09-25

The owner confirmed Windows is supported alongside macOS and is used every day.
Updated the README, compatibility table, bundled guide and handoff records. This
is owner-reported daily-use evidence, distinct from automated regression coverage;
the missing Windows report no longer gates the support statement. Exact Windows,
Trilium and client/browser versions were not supplied in the confirmation.

This follow-up changes documentation only. The package is regenerated with the
corrected guide; the prior native smoke result retains its original artifact hash
and is not presented as a rerun of the revised ZIP. Editor behavior is unchanged.
The widget was already at owner-created commit `2e7e9ed` when this follow-up began;
that commit and the parent gitlink change were preserved. No commits or remote
changes were made by the agent.
