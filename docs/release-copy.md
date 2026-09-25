# Distribution copy — prepared, not published

Prepared 2026-09-25. These are reviewable drafts for repository metadata and a
future release. No GitHub fields, release pages or community posts were changed.
Choose a release version and run the release checks before using the release copy.

## GitHub description

Compact, keyboard-driven mind maps for Trilium: brainstorm, keep reference notes and manage everyday checklists.

## Suggested repository topics

`trilium` · `trilium-notes` · `mind-map` · `mind-mapping` · `note-taking` ·
`knowledge-management` · `keyboard-navigation` · `checklist`

These describe current capabilities. Do not add mobile or FreeMind-import topics
until those features are implemented and verified.

## Next release title

Willow VERSION — maps for thinking, reference and everyday lists

## Next release body

Willow brings compact, keyboard-driven mind maps to Trilium. Add ideas with the
keyboard, rearrange whole branches, fold details and keep checkboxes beside your
notes. Windows and macOS are supported; see the dated compatibility evidence.

This release adds three synthetic example maps: **Workshop ideas** for brainstorming,
**Home reference** for facts with folded detail, and **Weekend packing** for a
checklist. The README includes a recorded workflow and a comparison with Trilium's
native Mind Map. Willow and its widget are MIT licensed, with notices included in
the installation and distributed editor.

**Requires Trilium Notes.** Browser access is through your Trilium instance, not a
hosted Willow account. Recorded host verification uses Trilium 0.105.0; the owner
also confirms daily Windows use. Link the release's exact compatibility report.

**First install:** download `trilium-willow-VERSION.zip` from this release's assets
(the actual filename may include build metadata). Import it into Trilium with Safe
import retained, then enable the **Willow Mind Map** template and the example maps.
Create your own maps outside the installation using **Templates → Willow Mind Map**.
GitHub's automatic Source code archives are not the installation ZIP.

**Existing installation:** follow the installation guide to replace shared editor
code while preserving its note ID. Importing the ZIP creates a separate installation.
An editor-only update does not install new example notes. Keep your own maps outside
installation subtrees and back up before updating. A guided upgrade is not part of
this release.

Each map is one Trilium note; nodes and checkboxes are map content. FreeMind import,
internal note links, dedicated image/document export and touch interaction are not
available. Sync is not concurrent collaborative editing. Preserve original sources
and avoid simultaneous edits across devices.

Report issues with your Willow/Trilium versions, OS, client/browser and reproduction
steps. Please use synthetic examples rather than sharing personal notes.

## Before publishing this draft

Replace VERSION and relative references with the actual tested tag, artifact names,
compatibility report, guide and media links. The current public release at preparation
is v0.2.1, which has the earlier small example; do not edit its notes to claim the new
package contents. This draft does not certify a published-version upgrade path.

Audience-specific introductions are in [audiences.md](audiences.md); these have not
been sent anywhere.
