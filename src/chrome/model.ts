import type { ActionId, CommandDescriptor } from '@mindmap/widget';

export const toolbarGroups: readonly (readonly ActionId[])[] = [
  ['undo', 'redo'], ['insertChild', 'insertAfter', 'delete'], ['edit', 'toggleCheckbox', 'toggleCollapse'],
];
export function visibleActions(width: number): Set<ActionId> {
  return new Set(toolbarGroups.flatMap((group, index) => index === 0 && width <= 360 || index === 2 && width <= 650 ? [] : [...group]));
}
export function overflowActions(items: readonly CommandDescriptor[], width: number): CommandDescriptor[] {
  const visible = visibleActions(width);
  // A retained item starts a group even when the group's original first item was filtered.
  let pendingSeparator = false;
  const result: CommandDescriptor[] = [];
  for (const item of items) {
    pendingSeparator ||= item.separatorBefore;
    if (visible.has(item.id)) continue;
    result.push({ ...item, separatorBefore: !!result.length && pendingSeparator });
    pendingSeparator = false;
  }
  return result;
}
export function steppedZoom(zoom: number, direction: -1 | 1): number {
  return Math.max(.25, Math.min(4, Number((zoom + direction * .1).toFixed(10))));
}
export interface PaneState {
  invalid: boolean;
  loading: boolean;
  recovering: boolean;
  readonly: boolean;
  viewer: boolean;
  editing: boolean;
}
export function paneSummary(state: PaneState, editingHint: string): string {
  if (state.invalid) return 'Map unavailable';
  if (state.loading) return 'Loading map…';
  if (state.recovering) return 'Recovering…';
  if (state.readonly) return 'Read-only';
  if (state.viewer) return 'Viewing · another pane owns editing';
  if (state.editing) return `Editing label · ${editingHint}`;
  return '';
}
