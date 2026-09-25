# Canonical example maps

`maps.json` contains the three synthetic maps used by the package and A2 media.
Each entry supplies a stable key, note title, use case, description and complete
version-1 Willow document. Keep the note title equal to the root text: Trilium's
note title is authoritative when the map opens.

- **Workshop ideas:** open brainstorming hierarchy; also the native comparison fixture.
- **Home reference:** frequent facts with folded appliance details.
- **Weekend packing:** checked and unchecked items; starting point of the workflow recording.

No personal data or external assets are included. See [the user walkthrough](../docs/examples.md).
The files are package input, not a separate user-facing JSON import feature.

After edits: run `pnpm package`, `pnpm test:packaging`, and the capture/check procedure
in [A2 evidence](../docs/evidence/a2/report.md). Update screenshots when content changes.
