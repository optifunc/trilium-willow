# Compatibility and public baseline

Checked 2026-09-25. “Tested” describes the specific checks below, not certification
of every feature or client. Windows and macOS are supported; Windows support is
confirmed by the owner’s daily use on 2026-09-25. A1 tested source: Willow `b480c6e`, widget `c8f363d`,
plus the A1 working-tree changes. No new release has been published.

| Trilium | Client/browser | OS | Support / verification status | Evidence date and scope |
| --- | --- | --- | --- | --- |
| 0.105.0 | Native desktop, official ARM64 release; Electron 43.4.0 / Chromium 150.0.7871.224 | macOS 26.7, Apple M2 | Tested: A1 package smoke | 2026-09-25: fresh setup, Safe import, activation, licensing note, native template creation, keyboard child edit, save/reload; [results](evidence/a1/clean-desktop.json) |
| 0.105.0 | Chrome/Chromium 153.0.0.0 (headless UA) | macOS; exact OS release not recorded in historical result | Tested: historical browser integration | 2026-09-22: [zoom and wheel results](evidence/wheel-step/trilium.json); earlier broader [browser/distribution and lifecycle results](evidence/chrome/regressions.json), 2026-09-17 |
| 0.105.0 | Native desktop, official ARM64 release | macOS; exact OS release not recorded in historical result | Tested: historical integration | 2026-09-17: [distribution and close/sync results](evidence/chrome/regressions.json); [report and limits](evidence/chrome/report.md) |
| Version not recorded in owner confirmation | Owner’s daily-use Windows client; exact client/version not recorded | Windows; OS version not recorded | Supported: owner-confirmed daily use | 2026-09-25: owner confirms daily use and support; historical automated report unavailable; see below |
| 0.105.0 | Linux desktop / browsers | Linux | Unverified | No actual-client evidence retained |
| 0.105.0 | Safari / Firefox in Trilium | macOS or other OS | Unverified | Widget-only engine tests do not establish host compatibility |
| 0.105.0 | Mobile Safari / Chrome, touch interaction | iOS / Android | Unverified; not a supported interaction path | Owner reported non-responsive touch during the planning trial; no device certification |
| Other versions | Any client | Any OS | Unverified | API inspection alone does not establish compatibility |

The historical browser user agent contains `Mac OS X 10_15_7`; browsers freeze
this value, so it is not evidence of the actual OS release. Likewise, simulated
Windows shortcuts and widget-only WebKit tests do not establish Windows or Safari
host support. The new desktop result records the runtime UA separately.

## Windows evidence

The owner confirmed on 2026-09-25: “windows is supported as well as macos, i use
it every day”. This is direct daily-use evidence and establishes Windows support.
The confirmation does not specify exact Trilium, client/browser or Windows versions;
those details are not inferred from the older report.

The old README, installation guide and 2026-09-12 development log referred to
`docs/test-windows.md`, which is absent from the checked-out repository. Its absence
is a gap in the archived automated test evidence, not a reason to withdraw Windows
support. Later [wheel testing](evidence/wheel-step/report.md) exercised Windows
bindings on macOS without native Windows hardware. A future Windows run can
restore detailed versioned regression evidence; it is not a prerequisite for the
owner-confirmed support statement.

Historical `.test/` paths in development reports are labelled local-only, not
linked as publicly available evidence. Checked-in reports above are the durable
baseline. The current A1 smoke does not repeat the full historical regression
matrix or establish upgrade, concurrent editing, mobile or human usability claims.

## Public repositories and releases

The following facts were read anonymously from GitHub on 2026-09-25; the selected
API fields and release assets are retained in [public metadata](evidence/a1/public-metadata.json).

- [Willow](https://github.com/optifunc/trilium-willow) and
  [mr](https://github.com/optifunc/mr) are public, with default branch `main`.
  Both descriptions and topic lists were empty at inspection.
- Willow's latest published release is
  [v0.2.1](https://github.com/optifunc/trilium-willow/releases/tag/v0.2.1), published
  2026-09-22, with install ZIP `trilium-willow-0.2.1+build.7.1.zip`, editor, guide
  and manifest. No latest public release was returned for `mr` (HTTP 404).
- [Trilium 0.105.0](https://github.com/TriliumNext/Trilium/releases/tag/v0.105.0),
  published 2026-08-19, was still the latest stable release at inspection.
- GitHub reported no license for either project at inspection. The owner selected
  MIT on 2026-09-25; [local licensing changes](licensing.md) are complete, but those
  changes and the required future widget pin update have not been published.

## Host interfaces checked at 0.105.0

| Interface used by Willow | Official source and finding |
| --- | --- |
| `trilium:preact`, hooks | [Public Preact export surface](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/services/frontend_script_api_preact.ts) includes the host hooks; [implementations](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/widgets/react/hooks.tsx) include `useNoteContext`, `useNoteBlob`, `useEffectiveReadOnly`, `useTriliumEvent` |
| `trilium:api` | [Frontend scripting API](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/services/frontend_script_api.ts) supplies `originEntity`, confirmation and note/tab operations |
| Render relation and activation | [Render service](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/services/render.tsx) loads related code notes; [Render widget](https://github.com/TriliumNext/Trilium/blob/v0.105.0/apps/client/src/widgets/type_widgets/Render.tsx) exposes activation of `disabled:renderNote` |
| Note persistence and recovery | Willow's `src/host.ts` calls internal `/api/notes/...` routes using `glob.baseApiUrl` and `glob.getHeaders`; [host routes](https://github.com/TriliumNext/Trilium/blob/v0.105.0/packages/trilium-core/src/routes/api/notes.ts) were inspected. These are version-coupled internal interfaces, not the documented ETAPI contract |
| Pane lifecycle and save status | Adapter uses host note contexts, event names and frontend DOM integration. Passing on 0.105.0 does not promise future compatibility; retest after host changes |

Use the [reproducible setup](testing.md) for a new checkout. A1 changes only
licensing, packaging, CI, setup tooling and documentation; existing map behavior
and documents are preserved.
