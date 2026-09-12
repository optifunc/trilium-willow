import { expect, it } from 'vitest';
import { captureView, parseView } from '../src/view-state';
it('stores map coordinates at the centre independently of pane dimensions', () => {
  expect(captureView({ x: 200, y: 100, zoom: 2 }, 800, 600)).toEqual({ version: 1, centerX: 100, centerY: 100, zoom: 2 });
  expect(captureView({ x: 0, y: 0, zoom: 2 }, 400, 400)).toEqual({ version: 1, centerX: 100, centerY: 100, zoom: 2 });
});
it.each([null, '{', '{}', '{"version":1,"centerX":0,"centerY":0,"zoom":0}',
  '{"version":1,"centerX":"0","centerY":0,"zoom":1}'])('ignores unusable saved views: %s', value => {
  expect(parseView(value)).toBeUndefined();
});
it('accepts old view state and ignores malformed selection without losing its viewport', () => {
  const view = { version: 1, centerX: 80, centerY: -20, zoom: 1.2 };
  expect(parseView(JSON.stringify(view))).toEqual(view);
  expect(parseView(JSON.stringify({ ...view, selection: { ids: [123] } }))).toEqual(view);
  expect(parseView(JSON.stringify({ ...view, selection: { ids: ['a', 'b'], activeId: 'b', text: 'not view state' } })))
    .toEqual({ ...view, selection: { ids: ['a', 'b'], activeId: 'b' } });
});
