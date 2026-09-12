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
