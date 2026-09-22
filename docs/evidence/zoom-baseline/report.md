# Willow zoom baseline — 2026-09-22

Willow displays actual scene zoom divided by 1.43. Fresh views and reset use
1.43 (displayed 100%). Status buttons add/subtract 0.143 actual scale, preserving
fit precision. Displayed limits stay 25–400%, with actual limits 0.3575–5.72.
Keyboard and wheel multiplication, geometry, typography and chrome sizing are
unchanged. Widget options drive initial/reset scale and all clamp/Fit paths.

Saved version-1 views continue storing actual scale and world center. Values in
the new range retain their appearance and position; old values below 0.3575
clamp to that minimum while retaining their center. No map JSON changes.

Bundle SHA-256: `835cf6fbd95477e16d79f3a71d20874183f7f3d3670bf209b0b2d2b55753fb97` (working tree).

Passed:

- Widget and adapter typechecks/build; 195 widget and 68 adapter unit tests.
- Widget zoom options and event-ownership checks: 33 cases across Chromium,
  Firefox and WebKit, including exact world geometry/path equality at 1.43,
  configured reset and clamps, Fit, editing, and default instance isolation.
- Packaged consumer in all three engines; [widget evidence](../../../mr/docs/evidence/zoom-baseline/report.md).
- `pnpm test:chrome`: 14 chrome/lifecycle groups. [Chrome](chrome.json),
  [lifecycle](lifecycle.json), visually inspected [100% view](100-percent.png).
- `pnpm test:zoom`: keyboard/numpad/reset/limits, Fit, wheel/pan ownership,
  unchanged saved map bytes, actual zoom and world center after reload.
  [Results](zoom.json).

Initial test corrections: screen-space DOMRect equality between widgets at
separate page offsets had subpixel subtraction noise; compare exact world node
geometry and connector paths plus actual zoom instead. The existing reload test
waited only 200ms for a 250ms delayed save, masked by its former 1.0 default;
it now waits for persisted zoom and center before reloading. No visual baselines
or geometry tolerances were changed.

Native desktop was not rerun for this change. User visual review remains pending.
To try it, restart `pnpm dev:desktop` and use Reset zoom on a remembered map.
