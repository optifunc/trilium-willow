# Bar and menu sizing — 2026-09-21

Refined the initial enlargement following the user's feedback: 15px text using
Trilium's theme font, 24px icons (20px Delete), 36px toolbar buttons, a 45px toolbar
and a 34px status bar with 30px controls. The final status-only refinement uses
13px text and 20px icons, preserving the toolbar and menu sizes. The zoom percentage target is 50px wide.
Both menus share the toolbar's font property and use natural-height rows, 280px wide
capped to the pane. Following review, vertical item padding was reduced from
7px to 4px, then increased by 1px on each side to the requested 5px. The 36px
minimum row height was removed. Center alignment eliminates
the former 2.5px excess below the labels. Single-line rows now measure 30.75px,
with equal 6px gaps above and below the text (including the 1px button border).
Outer menu spacing is also equal: 4px top and bottom, including its border.
Typography is 15px/18.75px Inter, matching the toolbar.

Responsive CSS and More composition agree at 800px (edit/help), 440px (history),
520px (hide creation icons/Fit text) and below 320px (icon-only creation).

Passed build, TypeScript, 60 adapter unit tests, and `pnpm test:chrome` including
all 14 integration/lifecycle groups. Checks cover every new breakpoint, widths
240–1134px without horizontal overflow, stable edit activation, zoom precision,
view retention, read-only transitions, independent pane visibility and modal cleanup.
See [browser results](browser.json) and [lifecycle results](lifecycle.json).
For the latest font/icon/padding refinement, the build and targeted browser checks
passed for both menus at 1134, 320 and 240px: equal inner/outer vertical spacing,
matching 15px bar/menu text, 24px standard icons, no horizontal overflow at all
responsive boundaries, End-key navigation and Escape dismissal.

Visually reviewed the production [full-width bars](full.png) and
[320px bars](narrow.png), [More](more.png) and [context menu](context.png).
See [measured menu sizing](menu-sizing.json) and the final
[status-only sizing check](status-sizing.json). The final CSS build and browser
measurement passed: status 13px/20px, toolbar 15px/24px, menus 15px with 5px vertical padding. Deployed to the isolated server. The manual desktop
launcher loads this build on its next run; no manual desktop database was changed.

Bar-button tooltip text was increased from 12px Arial to 14px in Trilium’s theme
font, retaining 1.4 line-height. Build and targeted browser checks passed for both
toolbar and status-bar controls: computed size/family, viewport bounds, and hover
dismissal. See [tooltip measurements](tooltip-sizing.json).

The extra space below the status bar measured 8px outside the pane, caused by
subtracting 8px from the native content height. Removed that deduction so the
status bar meets the content-area bottom. Its content retains centered spacing
inside the top border. The latest status text/icons are 13px/20px.
