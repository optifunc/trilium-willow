# Willow toolbar and status bar design

Status: **design exploration, revision 6**. Updated 2026-09-17. This document specifies the design for implementation; the [implementation plan](implementation-plan.md) tracks the authorized work. The command inventory was taken from repository commit `5ccbab5` and the locally available Trilium theme source.

This is the living implementation handoff. Update appearance, behavior, command mappings, and the decision log whenever the design changes, along with the prototype and its captures. Prototype JavaScript is disposable simulation code, not a proposed editor implementation.

## Approved sizing amendment — 2026-09-21

The user requested larger bars, then refined them to a slightly smaller size
and asked that More and the context menu match. This amendment supersedes the
revision-6 dimensions below: 15px text in Trilium’s `--main-font-family`, 24px
icons (20px Delete), 36px toolbar buttons, a 45px toolbar, and a 34px status bar
with 30px controls. The status bar uses 13px text and 20px icons; toolbar
and menu text stays at 15px, with 24px standard toolbar icons. Both menus share
the toolbar’s font, with 5px vertical/10px
horizontal item padding, centered content and natural row height (30.75px for
one line), at 280px width capped to the pane. The pane fills the native content
area; the former 8px bottom height deduction is removed. Hiding both bars releases 79px. Bar-button tooltips use 14px text with a 1.4 line-height
and Trilium’s font family. Responsive thresholds are 800px for edit/help overflow, 520px for
text-only creation controls and icon-only Fit, 440px for history overflow, and
below 320px for icon-only creation controls. The prototype and its original
captures remain the revision-6 reference; current implementation captures and
verification are in [the sizing evidence](../../evidence/chrome-scale/report.md).

## Review artifacts

Open [the design](design/toolbar-statusbar/index.html) directly in a browser. No build, server, account, or network access is required. The toolbar is 41px high and the status bar is 30px high. [Captured previews](design/toolbar-statusbar/previews.html) include light/dark × full/split layouts, incoming changes, More, a tooltip, and the shortcuts dialog in both themes.

The **Field guide** map contains 19 nodes, 16 initially visible, 3 descendants hidden, two root sides, an ellipse root, plain branch lines, checked/unchecked tasks, a whole-label URL, and two collapsed branches. **Draft the outline** is initially selected. The neighboring split-pane note is **Working notes**. The Trilium shell is an approximation based on existing integration screenshots and local Next theme CSS, not a running instance.

The controls above the shell belong to the design review. They switch light/dark, full width/440px split pane, UI state, selection, and Mac/Windows shortcut labels. At 1440px browser width the map pane is approximately 1134px wide or exactly 440px in split mode. Smaller windows reduce the preview pane width.

The preview invokes Fit on initial load, Reset demo, and the review layout switch to display the whole map. **Production must preserve zoom/pan on pane resize.** The full-width fixture starts at 100%; the narrow fixture fits at approximately 53%. Bars and menus remain at host UI scale regardless of map zoom.

Simulation covers selection, inline editing, provisional creation/cancellation, undo/redo, collapse/expand, checkboxes, a private demo clipboard, zoom/Fit, menu keyboard navigation, a modal shortcut reference, and recovery actions. The note tree and neighboring note are static. Clipboard operations do not access the system clipboard; links do not open; recovery never writes a note. Layout, drag/navigation, clipboard subtree parsing, concurrency, title synchronization, IME, and host lifecycle are not editor reimplementations. Recovery text explicitly says “simulated”; invalid-document source is synthetic.

## Inventory: what exists today

| Area | Existing behavior and source |
|---|---|
| Adapter chrome | No permanent Willow toolbar/status bar. Trilium's header reports saving state. [`src/spike.ts`](src/spike.ts) mounts the editor, grants editing ownership, renders notices/recovery, and forwards `saveState` into the note context. |
| Context menu | 13 entries in stable order, dynamic collapse/checkbox labels, six groups separated by rules. [`mr/src/interaction/menu.ts`](mr/src/interaction/menu.ts). Open with node right-click, Shift+F10, or Context Menu key. |
| Menu appearance | 250px wide capped to host; 3px outer padding; 4px menu/item corners; 1px #888 border; shadow `1px 2px 5px #0003`; items `4px 9px`; shortcut column aligned right. [`mr/src/styles.css`](mr/src/styles.css). |
| Content and history | Insertions, edit/setText, deletion, restructuring, checkbox and collapse state, undo/redo. Public `execute`, `canExecute`, `canUndo`, `canRedo`. [`mr/src/editor.ts`](mr/src/editor.ts), [`mr/src/commands/reducer.ts`](mr/src/commands/reducer.ts), [`mr/src/types.ts`](mr/src/types.ts). |
| Input/navigation | Arrows navigate, Shift+arrows extend selection, Primary+arrows move selected sibling blocks, pointer drag moves nodes, printable input begins replacement editing. [`mr/src/interaction/input.ts`](mr/src/interaction/input.ts). |
| Selection | Root, leaf, branch, hidden descendants, multiple nodes, active node, or no selection. Targeted commands use the active node; group commands use selected IDs. Root cannot be deleted/cut; root insertion has special existing semantics. |
| Label editing | F2 or editNode; Enter commits, Shift+Enter adds newline, Escape cancels. Insertions are provisional until commit, one undo transaction with initial text. Native textarea editing/clipboard/undo remains native. Root label is synchronized with Trilium's note title. |
| View | Zoom .25–4; steps ×/÷1.2; reset 100%; Fit; panTo, panToNode, pointer/wheel pan. No view changes in document history. [`src/view-state.ts`](src/view-state.ts) retains pane-local selection/viewport. |
| Persistence | `loading`, `saved`, `unsaved`, `saving`, `error`, `conflict`; also in-progress editing and recovery. [`src/save-session.ts`](src/save-session.ts), [`src/title-session.ts`](src/title-session.ts). Drafts retained in memory; no durable offline-draft guarantee. |
| Ownership | One editing pane per document. A second pane is a viewer with **Edit here**. Effective Trilium read-only is separate and cannot be bypassed by **Edit here**. |
| Recovery | Retry save; Keep both creates a sibling recovery map then loads original; Use incoming confirms discarding local work. Busy recovery blocks interaction. Invalid document offers original source and Reload saved map. Successful recovery can expose Open recovery copy. |
| Events | documentchange, selectionchange, viewportchange, editstart, editcommit, editcancel, commandcomplete, linkopen, error. Detailed contracts: [`mr/docs/api.md`](mr/docs/api.md). |

### Complete command placement

“Primary” means Command on macOS, Ctrl on Windows/Linux. Canvas shortcuts apply only while the map owns focus, not in Trilium title fields or the label textarea.

| Existing command/API | Shortcut or gesture | Design placement |
|---|---|---|
| `undo()` / `execute({type:'undo'})` | Primary+Z | Toolbar Undo |
| `redo()` / `execute({type:'redo'})` | Primary+Shift+Z; Primary+Y also supported | Toolbar Redo; tooltip shows first shortcut |
| `execute({type:'edit'})` / `editNode(id)` | F2; existing label-edit gestures | Toolbar Edit and menu |
| `setText` | Label commit / API | Internal commit path, no independent bar control |
| `insertChild` | Tab | Toolbar Add child and menu |
| `insertBefore` | Shift+Enter | Menu Add sibling before |
| `insertAfter` | Enter | Toolbar **Add sibling**; context/More menu **Add sibling after** |
| `insertParent` | Shift+Tab | Menu Insert parent |
| `delete` | Delete | Toolbar Delete beside Add child/Add sibling; full context menu |
| `cut`, `copy`, `paste` | Primary+X/C/V | Menu; native textarea clipboard remains native |
| `toggleCollapse` | Space | Toolbar and menu with dynamic Expand/Collapse label |
| `expand`, `collapse` | Collapsed marker uses `expand`; API also supports explicit states | Existing marker; bars use `toggleCollapse` |
| `addCheckbox`, `removeCheckbox` | Primary+1 | One toolbar/menu action, named from checkbox presence on active node |
| `toggleChecked` | **Ctrl+Space on every platform**, including macOS | Menu Toggle checked state; existing checkbox direct control |
| `openLink` | Primary+click on URL label | Menu Open link; preserve delayed link hint |
| `move`, `moveSelection` | Drag/drop; Primary+arrows for contiguous sibling selection | Existing gestures; no new bar controls |
| `navigate` | Arrows; Shift+arrows extends | Existing canvas keys; shortcut help |
| `selectAll`, `clearSelection` | Primary+A; Escape clears | Existing canvas keys; shortcut help |
| `zoomIn`, `zoomOut` | Primary+plus/minus; modified wheel | Existing canvas input paths; Status buttons instead use additive `setZoom` steps (revision 3) |
| `resetZoom` | Primary+0 | Click status percentage to reset to 100% |
| `fit` / `fit()` | Primary+Shift+physical Digit0 | Status Fit |
| `setZoom`, `getViewport`, `panTo`, `panToNode` | API / view gestures | State and existing gestures; no new slider or pan mode |
| `getSelection`, `setSelection`, `getDocument`, `setDocument` | Host APIs | State only; no “replace document” bar action |
| `focus`, `refreshLayout`, `destroy`, subscriptions | Host lifecycle | Implementation plumbing, not user commands |

No dedicated export, color palette, formatting, automatic arrangement, global expand-all, minimap, manual Save button, synchronization indicator, or durable offline badge is proposed. These would imply capabilities outside the current surface.

## Theme conventions and the context-menu relationship

Sources inspected locally: `.test/trilium/server/public/stylesheets/theme-next-light.css`, `theme-next-dark.css`, and `theme-next/base.css`, plus `.test/trilium/evidence/hardening/next-light.png`. These installation files are not checked-in design dependencies. The adapter currently inherits main background/text, dark selection, menu background, and hover from Trilium; several menu border/disabled/separator colors remain fixed widget defaults.

Next uses Inter for host text, neutral low-profile buttons, monochrome icons, a subdued note tree, a native note header with a teal Render note badge, and a separate application status/footer area. Willow's bars belong **inside the note pane**, under the native note header and above Trilium's application footer. No Willow logo, document title duplicate, colored main CTA, or save badge is added to either bar. The green design-study brand is outside the product preview.

| Role | Production token/fallback | Prototype light / dark |
|---|---|---|
| Surface | `--main-background-color`, fallback #fff | #fff / #242424 |
| Foreground | `--main-text-color`, fallback #171717 | #171717 / #ccc |
| Rule | `--main-border-color`, fallback #dbdbdb | #dbdbdb / #454545 |
| Secondary text | `--muted-text-color`, fallback #666 | #666 / #bbb |
| Hover | `--hover-item-background-color`, then `--accented-background-color`, then #e8e8e8 | #e8e8e8 / #383838 |
| Selected map nodes | Current adapter contract: #d2d2d2 light; accented background dark | #d2d2d2 / #555 |
| Focus | Host focus token when sufficient, otherwise theme-aware outline | #386855 / #a2c8b3 |
| Failure text | Host semantic token if available; otherwise scoped fallback | #a13528 / #f3a69b |
| Recovery banner | Host alert token if suitable; otherwise scoped fallback | #fff4df + #764b12 text / #3a3021 + #edc789 text |

Scope Willow tokens to the adapter, not `:root` in production. The prototype's `:root` tokens emulate host themes. Theme switching changes color immediately without remounting the editor or losing selection/history. Font or geometry changes require `refreshLayout()` through existing lifecycle code. Classic/custom themes must work through fallbacks; do not depend solely on `.dark-theme` for every color.

Bars and context menus share 4px corners, monochrome stroke icons where icons are used, the same foreground/muted/disabled colors, hover/focus treatment, divider colors, vocabulary, and enabledness. Preserve the current **text-only context menu**; do not add a decorative icon column. Dark-mode separator and disabled-color cleanup is a proposed scoped adaptation for consistency, not a completed production fix. The prototype uses a lighter dark-mode URL color (#9eacff); the widget currently uses #0000EE, so any production link-color change is a separately reviewed theme improvement, not inherent to adding bars.

### Icon choice — revision 6

The user's screenshot is Trilium's **CKEditor text-note toolbar**, not the note-tree icon font. Confirmed in the local installation: `public/stylesheets/ckeditor-theme.css` maps `--ck-color-toolbar-*`, button and tooltip colors into Trilium theme variables. Bundled `public/src/src-CdhYb_a_.js` contains 20×20 CKEditor SVG glyphs. The [CKEditor UI library documentation](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/ui-library.html) also demonstrates the 20×20 SVG convention and icon components.

Decision: **draw a small, original Willow SVG set in the same visual style**, rather than introduce a separate third-party icon pack. The revised prototype copies no CKEditor path data and downloads no icons. This avoids a stylistic mix while allowing domain-specific child/sibling symbols. If implementation later reuses actual host-exported icons, treat their availability and dependency terms as a separate integration choice, not a requirement of this prototype.

`refinedPaths` in `design/toolbar-statusbar/prototype.js` is the reviewable original vector source. Toolbar icons occupy a 20×20 viewBox rendered at 20px, monochrome `currentColor`, 1.65px strokes, rounded joins/caps, mostly 2.5–17.5px visible bounds. Compare with the previous 16px rendering, which appeared small/light next to Trilium. The Delete cross is the intentional exception: its 20×20 viewBox renders at **17×17px**, centered within the same 32px button, with slimmer filled tapered silhouettes. The clickable target is unchanged. Status zoom icons stay 16px. No raster/image-generation assets or webfont dependency.

| Action | Glyph |
|---|---|
| Undo / Redo | Mirrored horizontal return arrows with a curved tail |
| Add child | Parent rectangle, descending elbow, separated plus below/right. Connector ends at x=8.25; plus begins at x=11.75: 3.5px centerline gap (about 1.85px clear ink gap at 1.65px stroke). |
| Add sibling | Existing horizontal rectangle, next row with plus |
| Delete | Filled brush-style X based on the user’s reference: two intersecting curved, asymmetric silhouettes, narrower rounded starts, slimmer crossing bands and tapered ends. Monochrome `currentColor`, no outline stroke, gradient, shadow, or red fill. |
| Edit | Diagonal pencil with a clear nib |
| Add/Remove checkbox | Outlined square and check; label conveys presence operation |
| Expand / Collapse | Plus inside a circle: center (10,10), radius 7.25, plus arms from 6.5 to 13.5. Use this glyph for the toggle in both states, as requested; its accessible label and tooltip still switch Expand/Collapse. |
| Keyboard shortcuts | Keyboard rectangle, key rows and spacebar |
| Documentation | Question mark inside a circle; 20×20px, circle centered at (10,10), radius 7.25, same stroke weight as the other outlined icons |
| More | Text **More** plus 14px down chevron; no ellipsis |

Delete does not become red on ordinary hover. It remains disabled when the selection is empty, contains the root, or the editor disallows mutation. Activation uses the existing undoable Delete command; no new confirmation dialog is introduced.

## Appearance specification — revision 6

The toolbar exposes creation/history and viewport recovery alongside the existing keyboard and context-menu workflow. Fixed controls remain discoverable while panning or zooming, and their dimensions are predictable in Trilium splits.

All sizes below are CSS pixels before host/browser scaling, **never map-scaled**.

- Toolbar: 41px rendered height (32px buttons, 4px top/bottom padding, 1px bottom rule), 9px horizontal padding, no wrapping, 1px bottom rule, no shadow. Subtle host-style surface: `color-mix(in srgb, main-background 65%, left-pane-background)`. Production fallback is the host toolbar/neutral surface. Status bar: 30px minimum height, 0 10px padding, 1px top rule, main background. Map fills the remaining height with `min-height:0`.
- Toolbar controls: 32×32px icon targets; 20×20px icons; 4px corners. Labeled buttons have 7px horizontal padding and 7px icon/text gaps; labels use 12px host font. All actions have the same neutral resting treatment; Add child no longer has a persistent highlight.
- Order: **Undo, Redo | Add child, Add sibling, Delete | Edit, Add/Remove checkbox, Expand/Collapse, More ▾ — flexible space — Keyboard shortcuts, Documentation**. Delete is an icon button in the creation/removal group. Add child and Add sibling both show labels. Bars keep this order across selection changes. More sits 4px after the edit group (directly after Collapse); flexible space comes **after More**, leaving the Keyboard shortcuts/Documentation pair at the far right, in that order, with a 4px gap. At narrow widths where the edit group is hidden, More stays beside the last visible command group.
- The toolbar's **Add sibling** means `insertAfter`; its tooltip is “Add sibling (Enter).” The context/More descriptor retains the more specific **Add sibling after**. This is an intentional shorter toolbar label for the same command, not a new operation.
- Dividers: 1×18px with 3px side margin. Groups use 2px gaps; top-level elements use 4px gaps. Icons and labels have exact accessible names. More has `aria-haspopup="menu"` and accurate `aria-expanded`.
- **Remove all normal selection/count information**: no `1 selected`, node title, multiple-selection counter, `No selection`, total nodes, or hidden-node count in the status bar at any width. The normal left status segment is empty. The map itself continues to show selection. The permanent canvas hint is also removed.
- Status right: **− 100% + | Fit**. Percentage is rounded for display but keeps full internal precision; tabular numerals and a 42px reserved width. Status buttons are at least 26px high, with 11px text. Percentage activates reset to 100%.
- Status left is reserved for actionable state information: `Editing label · Enter to finish · Esc to cancel`, `Read-only`, `Viewing · another pane owns editing`, or loading/recovery/unavailable text. Persistent failure/conflict actions remain in the existing banner. Saved/Saving stays in Trilium's native header.
- Keep 2px keyboard-focus outlines on bar buttons. No new map-node focus outline. Tooltip and dialog specifications below are part of the prototype.

### Pane width rules

Use pane container queries, not only window width. A single row remains visible at all demonstrated widths. Overflow command order comes from the same context-menu descriptors.

| Pane width | Toolbar | Status |
|---|---|---|
| >650px | All controls above; More contains seven secondary node commands plus Hide UI | Empty normal left segment; − percentage + Fit on right |
| 421–650px | Move Edit, checkbox presence, Expand/Collapse, Keyboard shortcuts and Documentation into More. Keep Undo/Redo, both labeled creation actions with icons, Delete, More | Same zoom controls; only actual state text may appear on left |
| 361–420px | Additionally remove the child/sibling **icons**, retaining both full labels. Padding becomes 5px; gaps 2px | Fit becomes icon-only; 5px padding and 3px gaps |
| 280–360px | Additionally move Undo/Redo into More under a separated history group. Both creation labels, Delete, and More remain | Same zoom controls |
| <280px | Implementation fallback: child/sibling become icon-only, retain Delete and More; same accessible names/tooltips | State text may ellipsize; viewport controls retain priority |

The prototype and browser review exercise 320px as the minimum explicit target; the <280px fallback is specified for implementation, not demonstrated. Keyboard shortcuts and Documentation are direct toolbar buttons when there is room, and the final two More items otherwise, in that order. Keyboard shortcuts always opens the same dialog. Hidden actions are not lost.

### Tooltip behavior

Replace native button `title` tooltips with an explicit, theme-aware tooltip component:

- **200ms delay on every pointer entry**, including the first hover after page load. No initial 500–1000ms penalty, warm-up requirement, or extra entrance animation. Moving between buttons restarts the same 200ms timer.
- Keyboard `:focus-visible` shows the tooltip immediately. Include the label and platform shortcut, e.g. “Edit (F2),” “Add sibling (Enter),” “Undo (⌘Z)” or “Undo (Ctrl+Z).” Use a space and parentheses around the shortcut on every toolbar/status tooltip, never a middle-dot separator. Controls without shortcuts show their name only. Do not change the existing delayed map-link hint.
- Hide immediately on pointer leave, focus leave, pointer activation, Escape, menu/dialog opening, pane/browser resize, scroll, or replacement/destruction of the anchor. Clear pending timers. Tooltip never captures pointer input or focus.
- Use `role=tooltip` and temporary `aria-describedby`, preserving the button's accessible name. No duplicate native `title` on those controls. Disabled pointer-hover controls may still explain their command; keyboard navigation skips disabled toolbar buttons.
- Position 6px below toolbar buttons or above status controls, clamp at least 8px from viewport edges. 12px text / 17px line-height, 6×9px padding, 4px corners, restrained shadow. Light: #242424 background, white text; dark: #e5e5e5 background, #202020 text. These use host tooltip tokens when integrated.

### Keyboard shortcuts dialog

The keyboard button opens a **modal dialog**, never a command/context menu. The prototype uses native `<dialog>.showModal()` for top-layer rendering, background inertness and keyboard focus containment.

- Center on the application viewport. Width 660px; max width `100vw - 32px`, max height `100vh - 48px`, internal vertical scroll. 8px corners, theme surface/border, restrained shadow and #0005 backdrop.
- Header: **Keyboard shortcuts** and a close × with an accessible name. No subtitle or platform line. 24px horizontal/top and 18px bottom padding. Focus close on opening. Use `aria-labelledby` for the title; do not retain a dangling subtitle `aria-describedby` reference.
- Body: a two-column grid with sections in row-major order: **Create & edit**, **While editing a label**, **Selection & structure**, **Tasks & history**, **View & navigation**. Every section uses the same heading, label-left/shortcut-right rows, and spacing. 24px horizontal padding, 23px vertical padding/row gap, 32px column gap. Below 600px browser width use one column; the dialog scrolls vertically.
- **While editing a label** is a normal body section beside Create & edit: **Finish editing — Enter**, **Add a line — Shift+Enter**, **Cancel editing — Esc**. Do not repeat this content in the footer.
- Footer contains only a right-aligned **Done** button, a 1px top rule, and 12px vertical / 24px horizontal padding. The native-editing explanatory sentence is omitted; native editing behavior remains unchanged.
- Escape, close, Done, or a click outside the dialog bounds closes it. Focus returns to the keyboard button, or More when launched from narrow-pane overflow. Tab/Shift+Tab cannot reach background controls. Opening/closing does not mutate map content or selection.
- Show existing shortcuts with platform-correct Primary notation. Ctrl+Space remains Ctrl+Space on macOS. The dialog is reference content, not a collection of disabled menu items. Canvas shortcuts must not run while the modal owns focus.

### Documentation button

- Place **Documentation** immediately to the right of Keyboard shortcuts in the toolbar's far-right help controls. Use a 32×32px icon-only button, 20px circled-question-mark icon, and 4px gap. Accessible name and tooltip are exactly `Documentation`, with no shortcut suffix. The 200ms tooltip rule still applies.
- At pane widths ≤650px move both help controls into More as the final two items, Keyboard shortcuts then Documentation. They share a group; do not add a divider between them. Hiding UI hides the entire toolbar, including Documentation; Show UI restores it normally.
- Documentation is a host navigation action, not a `MindMapCommand`. Use a separate `openDocumentation()` callback. It is available independent of selection, editor read-only, and document load validity. More remains available during loading/invalid/recovery states for its host-only actions while editor commands stay disabled; do not send it through content-command applicability or history.
- **Prototype:** show “Documentation would open the Willow guide (simulated).” on activation. No navigation, new window, network access, or map mutation occurs. It works from the toolbar and overflow menu.
- **Recommended implementation destination:** the installed **Willow Mind Map add-on** help note, whose content is [`docs/installation.html`](docs/installation.html), packaged by [`scripts/package-addon.py`](scripts/package-addon.py). Open that associated installation's guide in a new Trilium tab, leaving the map available. Resolve its imported note ID through the installation associated with the map's shared editor; do not hard-code the archive ID `willowAddon`, rely only on its title, or link to this design specification. The future adapter must provide this resolver/navigation callback; it does not exist yet. If resolution fails, show a non-destructive “Documentation is unavailable for this installation.” message. This target is a documented implementation recommendation, not a production change in this design revision.

## Behavior and command mapping contract

### Shared command model

Implementation decision, 2026-09-17: the widget owns the authoritative command
and shortcut registry. Keyboard handling, menu descriptors, toolbar hints and
the Keyboard shortcuts dialog/keymap reference must consume that registry.
The adapter must not maintain a separate shortcut table. This includes
platform formatting, alternate bindings and the label-editing reference section,
while preserving native textarea handling. See the
[implementation plan](implementation-plan.md) for the registry/API work.

Derive toolbar and menu descriptors from one source of truth: `{label, command, shortcut, separatorBefore, canExecute}`. Preserve current `menuItems()` semantics. Host buttons call the existing public editor API, not reducers or synthetic key events. The public API reports `origin:'api'`; the widget's built-in menu reports `origin:'user'`. Do not claim they are already identical. If user-origin reporting for host chrome becomes necessary, agree a public integration API separately.

For editor commands use `canExecute(command)` at render time and again at activation. Keep host-owned Hide UI/Show UI and Documentation descriptors separate; do not pass them into `MindMapCommand`, reducers, or editor applicability checks. Use `canUndo()/canRedo()` for history. No optimistic enabledness based only on selection length. Subscribe to document, selection, edit, and viewport events and host ownership/read-only/session changes; history availability must update on document changes and edit completion/cancellation. Do not derive selection/count text; never persist `getDocument()` during provisional creation.

When a bar action is activated during label editing, preserve the widget's public command behavior: finish the edit, then run the action against the current editor selection. Pointer focus handling must not remove/rebuild the clicked button before click completes. Do not intercept native textarea clipboard, undo, Enter during IME composition, or host title editing. A toolbar action should return focus to the canvas when appropriate; opening an editor leaves focus in that editor. Menus restore focus to their invoker on Escape. Outside interaction must not steal focus from another pane or host field.

### Exact Node actions menu

This is the **full right-click/Shift+F10 context menu**. Retain the original 13 editor entries, including disabled ones, then append a separated pane-level Hide UI/Show UI action (14 total). More is a filtered secondary/overflow surface using these same descriptors, as specified below:

| Order/group | Label | Command | Shortcut |
|---|---|---|---|
| 1 | Edit | `{type:'edit'}` | F2 |
| 2 · divider | Add child | `{type:'insertChild'}` | Tab |
| 3 | Add sibling before | `{type:'insertBefore'}` | Shift+Enter |
| 4 | Add sibling after | `{type:'insertAfter'}` | Enter |
| 5 | Insert parent | `{type:'insertParent'}` | Shift+Tab |
| 6 | Delete | `{type:'delete'}` | Delete |
| 7 · divider | Cut | `{type:'cut'}` | Primary+X |
| 8 | Copy | `{type:'copy'}` | Primary+C |
| 9 | Paste | `{type:'paste'}` | Primary+V |
| 10 · divider | Expand / Collapse | `{type:'toggleCollapse'}` | Space |
| 11 · divider | Add checkbox / Remove checkbox | `{type:'addCheckbox'}` or `{type:'removeCheckbox'}` | Primary+1 |
| 12 | Toggle checked state | `{type:'toggleChecked'}` | Ctrl+Space |
| 13 · divider | Open link | `{type:'openLink'}` | None |
| 14 · divider | Hide UI / Show UI | Host `setUIHidden(!uiHidden)`; not an editor command | None |

Rules that must survive implementation:

- Right-clicking an unselected node selects it first. Right-clicking a selected member preserves the group **and its active node**. Opening More preserves both without retargeting.
- Edit, insertions, collapse and link use the active target. Delete, clipboard cut/copy and checkbox operations use the selection; paste uses active target. Selected ancestor/descendant normalization remains in the editor.
- Checkbox label depends on active-node checkbox presence, not whether it is ticked. Checkbox group operations follow reducer semantics: Toggle checked state checks all selected checkbox-bearing nodes if any are unchecked, otherwise unchecks them all. It does not invert every node independently.
- Root insertion stays enabled if `canExecute` says so. At root, child/before/after insert on the right (before inserts at the start); Insert parent adds a left child. Do not substitute an actual parent above the document root.
- A leaf cannot collapse; plain labels cannot Open link. An empty selection disables node actions individually, but an available More trigger may still open secondary commands for discovery. Copy/link remain possible in read-only mode; collapse does not.
- Up/Down wraps through all entries, including disabled entries; Home/End jump. Disabled entries use `aria-disabled` and cannot execute. Match the existing rule that keyboard highlight begins only after Up/Down. Enter/Space activate. Escape/Tab close. Pointer hover works immediately. Labels remain plain text; shortcut hints are separate and excluded from accessible names.
- Menu remains 250px wide capped to host, scrolls vertically if needed, clamps inside the pane, and is not map-scaled. Close on outside pointer/focus, selection/document changes, viewport moves, actual host resize, new editing, and destruction.
- More needs a host-anchored shared command-menu component backed by the same descriptors/applicability. There is no existing public “open context menu at this button” API. Do not synthesize a right-click or duplicate reducers. Reuse menu appearance and navigation rules; compose a different item list.

### More dropdown — distinct from the context menu

Revision 2 introduced **More ▾**, a labeled toolbar dropdown. In revision 3 the user retained it and requested that it sit directly after Collapse with the other commands. Its secondary/overflow list continues to use the revision 2 composition below. Right-click opens the original 13 editor commands followed by Hide UI/Show UI at the pointer. More opens below its button, clamped to the pane, and contains commands not currently visible in the toolbar.

At >650px the list is: **Add sibling before, Insert parent | Cut, Copy, Paste | Toggle checked state | Open link | Hide UI**. At 421–650px it is: **Edit | Add sibling before, Insert parent | Cut, Copy, Paste | Expand/Collapse | Add/Remove checkbox, Toggle checked state | Open link | Hide UI | Keyboard shortcuts, Documentation**. At ≤360px append **Undo, Redo** as a separate history group before Hide UI and the Keyboard shortcuts/Documentation group. Existing disabled items stay visible. Suppress orphan/leading separators after filtering. Dynamic labels continue to follow the active node.

Clicking More a second time closes it. Escape returns focus to More. Choosing a command follows the same enabledness and targeting contract as its context-menu counterpart. Choosing Keyboard shortcuts closes More and opens the modal; closing that modal returns focus to More. Close overflow on pane resize so the list cannot become stale as controls enter/leave the toolbar. More may add history/help/documentation because it is a distinct toolbar surface; the full context menu retains its editor actions and adds the single UI-visibility toggle.

### Hide UI / Show UI

- **More:** append **Hide UI** after the editor/history groups, with a divider; Keyboard shortcuts and Documentation remain after it when overflowed. **Context menu:** append one separated final item, **Hide UI** when bars are visible and **Show UI** when hidden. Labels are exact; there is no shortcut hint or new global hotkey.
- The action hides **both Willow toolbar and Willow status bar together**. Production decision updated 2026-09-21: persist a non-inheritable `willowUiHidden` label on the Trilium root note, shared by all Willow maps and installations and carried by Trilium sync. Collapse the bars’ layout space (`display:none` or equivalent) so the map gets the freed 79px. Hidden controls leave the tab order and accessibility tree. Do not add a floating replacement button.
- Trilium's note header/save indicator and application footer remain visible. Existing ownership, read-only, invalid-source, save-error, conflict, and recovery notices/actions remain visible. Hide UI must not conceal recovery work or error messages.
- Always allow restoring the bars via right-click on a node **or blank canvas**, Shift+F10, or the Context Menu key. Empty selection and read-only do not disable this action. During loading, invalid-document or recovery states, keep the pane-level context-menu route available while editor commands remain disabled. In production that host route must live outside any inert editor subtree. It must not let a UI action bypass content read-only/recovery guards. Textareas keep their native menu; a user may finish/leave a label or right-click blank canvas for the pane menu.
- After Trilium confirms the preference write, close the active menu/tooltip and update the layout in every pane. Move focus to the canvas (or an existing label editor) only when the currently focused bar/menu control disappears; preserve focus in other panes and native fields. Report failed writes and keep the last confirmed state. Announce “Toolbar and status bar hidden. Use the context menu to show UI.” / “Toolbar and status bar shown.” politely. Never return focus to a now-hidden More button.
- The toggle itself does not modify the map, selection, zoom, pan, history, save state, or editing ownership. No fit/reset, map-content write, or undo entry is caused by it. Normal blur-to-commit behavior still applies when leaving an active label to access a menu. Preserve the production editor viewport during resize; the simulation uses its usual centered fixture layout without changing zoom.
- Default to visible when the root preference is missing or invalid. All panes read the shared adapter store; native root-attribute events refresh it, and opening the first pane after all were closed reloads it. The preference survives reloads and editor recreation. Do not serialize it into map JSON. The original prototype remains a local simulation; Reset demo restores both bars.
- **Mapping:** More invokes host `setUIHidden(true)`; the final context-menu item invokes host `setUIHidden(!uiHidden)`. Reuse the existing menu styling, keyboard navigation and clamping, with a host-action descriptor/callback alongside editor-command descriptors. The current production widget has no such host action; this is an implementation requirement, not an existing editor command.

### Status viewport actions

| Control | Mapping | Behavior |
|---|---|---|
| − | `setZoom(max(.25, getViewport().zoom - .10))` | Subtract **10 percentage points**, clamped to 25%; disable at .25 |
| Percentage | `execute({type:'resetZoom'})` | Reset to 1; tooltip “Reset zoom (Primary+0)” |
| + | `setZoom(min(4, getViewport().zoom + .10))` | Add **10 percentage points**, clamped to 400%; disable at 4 |
| Fit | `execute({type:'fit'})` or existing `fit()` | Fit visible map using current host bounds; Primary+Shift+0 |
| Percentage updates | `viewportchange`, `getViewport()` | Frame-coalesced update; retain precision |
| Command applicability updates | `selectionchange`, `documentchange` | Update controls; no selection/count readout; no new history entry |

Revision 3 changes **status buttons only** from multiplicative ×/÷1.2 to additive ±.10 scale: 100% → 110% → 120%, then − → 110%. From a fitted scale, add/subtract .10 without first snapping or rounding to a decade; display the rounded percentage as before. Clamp at .25 and 4, including partial final steps (30% → 25%, 395% → 400%); 25% + → 35%. Prevent floating-point drift while preserving fit precision (prototype rounds step results to 10 decimal places). Use the existing public `getViewport()`/`setZoom()` API for eventual implementation; calling `zoomIn`/`zoomOut` directly would still apply the old factor. Canvas shortcuts retain their existing ×/÷1.2 behavior and wheel zoom remains continuous; a future request may unify those, but the current request specifies buttons.

Viewport actions must never zoom the host application. Resize and split-pane changes preserve view state. Read-only leaves selection/pan/zoom usable. While loading/invalid/recovering, disable map controls and show an explanatory state rather than stale counts.

## State and recovery presentation

Precedence for the pane summary: invalid/unavailable → loading → recovery → ownership/read-only → active label editing → empty normal summary. Error/conflict messages remain persistently visible in a **banner between toolbar and canvas** independently of the selection summary; neither is reduced to a transient toast. Save state remains authoritative in the native header. A document may be both read-only and have a retained dirty draft; do not hide that failure behind the read-only summary.

| State | Presentation and allowed actions | Existing mapping |
|---|---|---|
| Loading | Empty canvas loading message; disabled bars; omit counts | Session `state:'loading'` and mount readiness |
| Saved | Header Saved; only zoom controls in status | Session `state:'saved'` |
| Unsaved | Header Unsaved; no normal selection text | Session `state:'unsaved'` |
| Editing | Header Unsaved; status Enter/Escape help; preserve textarea | editstart/editcommit/editcancel, session editing flag |
| Saving | Header Saving…; edits remain available if writable | Session `state:'saving'` |
| Save error | Persistent “Save failed. Your draft is retained in this session.”; Retry save, Keep both, Use incoming if writable | Existing `flush()` / recovery handlers |
| Conflict | Persistent “Another version arrived.” + explanation; Keep both and Use incoming; no Retry save until resolved | `session.incoming !== undefined`; header receives error state |
| Recovering | “Recovering…”; disable recovery buttons and make canvas/commands inert | `session.recovering`; existing recovery guard |
| Viewer | “Viewing this map. It is being edited in another pane.”; Edit here; mutations disabled | `!ownsEdit && !readonly`; existing `takeEditing()` |
| Host read-only | Status Read-only; explanatory notice; no Edit here; copy/link/view allowed | `useEffectiveReadOnly` and editor read-only mount |
| Invalid | Retain original source; View original source, Reload saved map; no fabricated map or counts | Existing `invalid`, `source`, reload handler |
| Recovered | Persistent “Local work saved” with Open recovery copy when available | `session.recovered` and actual recovery-note link |
| Clipboard/command error | Non-blocking explanatory message; maintain selection; no fake success | editor `error`; clipboard success only on `commandcomplete` |

The prototype models these as a single scenario selector; the implementation must combine actual session flags correctly. A successful clipboard request return only means accepted, not completed. Do not announce success before `commandcomplete`.

Keep both calls the existing `resolve(true)` flow: commit active text, create/reuse a sibling recovery note, then adopt incoming content. Use incoming calls `resolve(false)` and retains the existing confirmation: “Discard your local changes and load the saved original?” Cancelling changes nothing. Retry save uses `flush()`, does not replace the document or clear a draft on failure. Edit here uses the existing serialized ownership transfer. Recovery busy/failed/newer-draft guards and before-unload behavior must remain intact.

Normal states do not need a new Save control. Do not label saving as cloud synchronization or imply a local draft survives abrupt process loss. Recovery errors can wrap to multiple lines and increase banner height; do not ellipsize the explanation/action labels in narrow panes. Destructive Use incoming must never become the default action solely to save width.

## Accessibility and integration acceptance

- Use semantic buttons, `role=toolbar`, a labeled status/viewport area, accessible names for every icon, platform-correct `aria-keyshortcuts`, visible keyboard focus, and menu/menuitem semantics.
- Production toolbar uses a single Tab entry with roving focus among enabled visible items; Left/Right/Home/End navigation. The prototype demonstrates arrow navigation but retains normal Tab stops for convenience during review. Existing canvas Tab insertion must not capture keyboard navigation inside toolbar/menu controls.
- Announce meaningful completion/failure and ownership changes politely; use an alert for errors requiring action. Do not announce every zoom tick or recite full map counts on every selection. Honor reduced motion and forced colors; color alone must not convey failure, checked state, or disabledness.
- Each pane owns its chrome, event subscriptions, menu, and view state. Unsubscribe/remove on destroy; no app-global hotkeys for toolbar navigation. Theme changes must not create a new document/session or steal focus.
- Verify all 13 editor menu entries and toolbar counterparts agree on operation, enabledness and command target for root, leaf, branch, link, checkbox, mixed multiselection, no selection, viewer, and host read-only.
- Verify label editing/provisional insertion and history; keyboard versus native text undo; IME; click focus; clipboard pending/denied/stale; title-sync; menu dismissals; view-memory preservation; two independent panes; save error/conflict/recovery races using existing production suites when implementation begins.
- Minimum review viewports: 1134px full pane, 440px split pane, 320px constrained pane; both themes. Check text clipping, banner wrapping, menu bounds, zoom limits, and no toolbar/status overflow. Prototype coverage is listed below; this does not certify a future integration.

## Validation and decisions

Run `node design/toolbar-statusbar/verify.mjs` from the repository root with existing Playwright dependencies. It launches a local browser, opens only local files, exercises the design, and regenerates preview PNGs. It does not start, read from, or write to Trilium. Screenshots belong only to this design directory.

The browser review checks both themes and full/split panes, toolbar/status bounds down to 320px, creation/editing/history, Delete/Undo, sibling insertion, branch collapse, checkbox group behavior, 14-item right-click menu (13 editor commands plus UI visibility), filtered More, link applicability, read-only/viewer transfer, loading/invalid source, save retry/recovery, platform hints, and modal focus/dismissal. It also checks 200ms first-hover tooltips, additive 10-point zoom buttons and bounds, preservation of canvas keyboard zoom, adjacent More placement, and the absence of normal status counts.

Revision 4 adds checks for the subtitle's removal, the three-row **While editing a label** body section, the Done-only footer, and dialog containment at a 520×760 browser viewport. Captures show the updated brush cross and revised dialog in both themes. No browser runtime errors or external requests were observed. This validates the prototype, not production integration or assistive-technology usability.

| Revision | Decision | Status |
|---|---|---|
| 1 · 2026-09-16 | Inventory current commands, host theme, context menu, and recovery states; isolate design work from production | Recorded and preserved |
| 2 · 2026-09-17 | Use fixed bars, remove normal selection/count text, label Add sibling, place Delete with creation actions | Accepted by user; implemented |
| 2 | Use 200ms tooltips and a modal keyboard shortcut reference | Accepted by user; implemented |
| 2 | Match the host toolbar's 20px SVG style; share command/menu vocabulary | Implemented |
| 3 · 2026-09-17 | Circled-plus toggle, wider Add child icon gap, additive 10-point zoom buttons, More directly after Collapse | Accepted by user; implemented |
| 4 · 2026-09-17 | No shortcut-dialog subtitle; label-editing commands become a normal body section | Requested by user; implemented |
| 4 | Delete uses the supplied brush-cross shape in the toolbar's monochrome color | Requested shape; implemented |
| 4 | Maintain one design page, one implementation, and one preview set with neutral names | Requested by user; implemented |
| 5 · 2026-09-17 | Delete glyph becomes smaller (17px) and thinner, preserving its 32px target | Requested by user; implemented |
| 5 | More gets Hide UI; context menu gets Hide UI/Show UI; both bars hide together | Requested by user; implemented |
| 6 · 2026-09-17 | Shortcut tooltips use parentheses: Edit (F2) | Requested by user; implemented for toolbar and status controls |
| 6 | Documentation with circled question mark appears to the right of Keyboard shortcuts | Requested by user; implemented, including narrow overflow and simulated action |

Revision 5 review covers both bars hiding/restoring together in all four theme/layout combinations, the larger canvas, unchanged selection/zoom/save/history, restoration via blank-canvas right-click and Shift+F10, and availability in read-only/loading/invalid/recovery states. Hidden-state and Show UI menu captures are included in the gallery.

Revision 6 checks Documentation placement/activation in both wide and narrow panes, unchanged responsive bounds, and parenthesized shortcut tooltips on Mac and Windows. Screenshots are refreshed.

Record subsequent user decisions here, amend the exact appearance/width rules and mappings above, and refresh the prototype/captures. Design refinement does not authorize production implementation.
