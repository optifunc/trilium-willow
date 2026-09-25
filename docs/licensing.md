# Licensing and distribution notices

The owner selected MIT for Willow, the `mr` widget, and their distributed code on
2026-09-25. See [Willow's license](../LICENSE) and [the widget license](../mr/LICENSE).
Copyright is attributed to Optifunc, the repositories' author identity.

Willow packages include the complete MIT notice in the editor JavaScript and an
imported **Licensing and notices** note. The standalone HTML guide retains the
notice in an HTML comment. The standalone widget package includes
`LICENSE`, and its built JavaScript also carries the notice. Retain these notices
when redistributing either project. Previously published release bytes are not
changed by this working-tree licensing update.

## Dependency audit — 2026-09-25

| Component | How it is used/distributed | Notice handling |
| --- | --- | --- |
| Willow adapter | Bundled JavaScript, CSS, examples and guide | MIT; full notice included in the ZIP and standalone editor |
| `@mindmap/widget` 0.1.0 | Only production workspace dependency; bundled into Willow | MIT; full widget notice included in the ZIP and standalone editor |
| Trilium `trilium:api` and `trilium:preact` | External imports resolved by the installed host | No Trilium or Preact implementation is shipped in the Willow ZIP |
| Vite, TypeScript, Vitest, Playwright and their dependencies | Development/build/test tools | Not shipped as dependency packages in the Willow ZIP; retain their own licenses when redistributing those tools |

The widget has no production package dependencies. Reviewed both package manifests,
source imports, Vite external configuration and generated JavaScript imports. The
packaging checks require both project licenses and preserve their full text in the
delivered editor and archive. Recheck this audit when adding a runtime dependency,
copied source, font or image. Tool installation is not evidence that its code is
embedded in the release.

Trilium and host-provided components retain their own licenses; this project does
not relicense them. See [Trilium's license at the tested version](https://github.com/TriliumNext/Trilium/blob/v0.105.0/LICENSE).
Reference screenshots in `mr/docs/free-mind-references/` depict third-party
software; MIT applies to original project material, not third-party rights in
those references. They are excluded from the widget npm package and Willow ZIP.

## Publication handoff

The widget licensing changes must be committed and made publicly available before
updating Willow's `mr` gitlink and publishing a release containing them. Until
then, the recorded widget revision remains `c8f363d` with local licensing changes.
No existing remote release or repository metadata has been modified.
