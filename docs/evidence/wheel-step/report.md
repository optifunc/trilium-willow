# One-point wheel zoom — 2026-09-22

Modifier+wheel uses direction alone: one nonzero vertical event changes actual
zoom by `default / 100`, or 0.0143 in Willow. Displayed zoom therefore changes by
one percentage point at any current zoom. Zero/horizontal-only events do not
zoom. Pointer anchoring, limits, keyboard steps, panning, history and map content
are unchanged.

Verified working-tree bundle: `e4cd8a3b920c5d0fe01bd0b3b2af6b0101bdaaf234fc6e1c3762cc0090c75b0c`.

- Widget and adapter typechecks/build passed; 195 widget and 68 adapter unit tests.
- 63 browser cases across Chromium, Firefox and WebKit: wheel-step,
  zoom-options, zoom-isolation and interaction suites. Covers Win32/MacIntel
  bindings, trusted small/large wheel input, pixel/line/page synthetic deltas,
  low/default/high zoom, 100-step reversals, zero/horizontal input, pointer
  anchoring, limits, event ownership and no document/history changes.
- [Widget packaged-consumer evidence](../../../mr/docs/evidence/wheel-step/report.md)
  passed in all three engines.
- `pnpm spike:deploy && pnpm test:zoom` passed against isolated Trilium v0.105:
  exact 0.0143 wheel step, reverse gesture, unchanged application zoom, keyboard
  and Fit, panning, saved map bytes, and view persistence. [Results](trilium.json).

The initial browser run passed 59/63 cases. Four new anchor assertions assumed
synthetic client coordinates retain fractions; Chromium/Firefox quantize them.
The tests now check the actual browser-delivered pointer coordinates, retaining
the same precision. All 12 wheel-step cases passed on rerun. No production fix
or tolerance relaxation was needed.

Windows bindings and deltas were exercised in browser tests on macOS; a native
Windows desktop/hardware run was not available. No screenshot baseline changed.
Restart `pnpm dev:desktop` to try the updated bundle.
