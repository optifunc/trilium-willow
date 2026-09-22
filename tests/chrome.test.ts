import { expect, it } from 'vitest';
import { getNodeMenuDescriptors } from '@mindmap/widget';
import { overflowActions, paneSummary, visibleActions } from '../src/chrome/model';

it.each([1134, 801, 800, 521, 520, 441, 440, 320, 319])('keeps every node action reachable at %ipx without duplicates or empty groups', width => {
  const items = getNodeMenuDescriptors();
  const overflow = overflowActions(items, width), visible = visibleActions(width);
  expect(overflow[0]?.separatorBefore).toBe(false);
  expect(overflow.map(item => item.id).filter(id => visible.has(id))).toEqual([]);
  expect(items.every(item => visible.has(item.id) || overflow.some(other => item.id === other.id))).toBe(true);
  expect(overflow.some(item => item.id === 'edit')).toBe(width <= 800);
  expect(visible.has('undo')).toBe(width > 440);
});
it('prioritizes unavailable states and accepts widget-sourced editing hints', () => {
  const state = { invalid: true, loading: true, recovering: true, readonly: true, viewer: true, editing: true };
  expect(paneSummary(state, 'Custom binding')).toBe('Map unavailable');
  state.invalid = false; expect(paneSummary(state, '')).toBe('Loading map…');
  state.loading = false; expect(paneSummary(state, '')).toBe('Recovering…');
  state.recovering = false; expect(paneSummary(state, '')).toBe('Read-only');
  state.readonly = false; expect(paneSummary(state, '')).toBe('Viewing · another pane owns editing');
  state.viewer = false; expect(paneSummary(state, 'Custom binding')).toBe('Editing label · Custom binding');
  state.editing = false; expect(paneSummary(state, '')).toBe('');
});
