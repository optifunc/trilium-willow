# Using Willow

Right-click a note in the tree,
choose **Insert note after** or **Insert child note**, then **Willow Mind Map**
under Templates. Enter the title in Trilium's normal title field. The map root
follows the title; editing the root also renames the note. On first opening a
map with different values, the Trilium title replaces the root text. Native title
typing updates the root after leaving the title field.

Edit a selected node with F2, commit with Enter, and insert a child with Tab.
Maps autosave committed changes. Fit the map with **Cmd/Ctrl+Shift+0**.
When a map is open twice, the viewer offers **Edit here** to transfer editing.
The toolbar provides editing commands; **More** contains commands that do not fit.
The status bar provides zoom, reset and Fit. Willow’s 100% uses the original
map geometry at 143% scale, keeping all proportions intact. Reset returns to
this size; buttons step by 10 percentage points within 25–400%. Modifier+wheel
zooms by one percentage point per event on every platform. Existing saved
views retain their actual size, except values below the new minimum are clamped. Open **Keyboard shortcuts** for the
complete reference, sourced directly from the widget. **Documentation** opens this
installation’s bundled guide in a new tab.

Choose **Hide UI** from More or the map context menu to hide both bars in all Willow maps.
Right-click the canvas or press Shift+F10 and choose **Show UI** to restore them.
This preference is stored once on the Trilium root note as the non-inheritable
`willowUiHidden` label and follows Trilium sync across devices.
Notices remain visible and the map’s position is preserved. Links show **Cmd+click to open** on macOS
and **Ctrl+click to open** elsewhere after one second of hovering over the node.
Leaving hides the hint; every re-entry starts a fresh one-second delay.
Copied outlines have no final newline.

New maps open with the root centred at 100% zoom. Position, zoom, selected nodes,
and the active node are remembered locally per document and browser/desktop
profile; split panes keep independent views. These changes do not modify note
content. Saved selections ignore deleted or hidden nodes, falling back to the root.

Click a Willow note in the left tree to focus its map, then use arrow keys to
navigate the selection. A newer click or focus change while the map loads takes
precedence, so editing the native note title retains focus.

Trilium’s note-header indicator reports map saving state. **Retry save**
retains the draft after a failure. For a detected external change, **Keep both**
saves local work as a sibling recovery map before loading the saved original;
**Use incoming** asks before discarding local work. Drafts stay in memory through
pane changes, but do not survive an abrupt process loss. Cross-device edits can
still race. Actual offline-sync tests confirm that Trilium picks one version when
both databases have already acknowledged competing edits. Invalid documents offer
their original source and a reload action.

Recovery is coordinated across panes, including refreshes. A newer draft or
unfinished edit invalidates a pending recovery result instead of being discarded.
On desktop, closing with unfinished work commits the label and starts saving; the first close
is blocked while saving or recovery is pending. Retry closing after the header
shows Saved, or use Retry save after a failed write.

Native subtree export/import preserves map JSON. Exporting only a map omits its
relation to the shared editor outside the archive; reattach `~renderNote` to the
installed Willow editor to render that imported map. Dedicated map export remains
deferred.


[Install and recover](installation.html) · [Examples and workflow](examples.md)
