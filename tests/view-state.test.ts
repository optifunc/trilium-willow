import { expect, it } from 'vitest';
import { captureView, PaneViews, parseView } from '../src/view-state';
it('stores map coordinates at the centre independently of pane dimensions', () => {
  expect(captureView({ x: 200, y: 100, zoom: 2 }, 800, 600)).toEqual({ version: 1, centerX: 100, centerY: 100, zoom: 2 });
  expect(captureView({ x: 0, y: 0, zoom: 2 }, 400, 400)).toEqual({ version: 1, centerX: 100, centerY: 100, zoom: 2 });
});
it('keeps each pane snapshot through replacement even when the outgoing cleanup runs late', () => {
  const panes = new PaneViews();
  const alpha = {version:1 as const,centerX:10,centerY:20,zoom:1.2,selection:{ids:['alpha'],activeId:'alpha'}};
  const beta = {...alpha,zoom:1.44,selection:{ids:['beta'],activeId:'beta'}};
  const old = panes.attach('first','map',()=>alpha);
  const second = panes.attach('second','map',()=>beta);
  expect(panes.get('first','map')).toEqual(alpha);
  const replacement = {...alpha,centerX:30};
  const release = panes.attach('first','map',()=>replacement);
  old();expect(panes.get('first','map')).toEqual(replacement);
  release();expect(panes.get('first','map')).toEqual(replacement);
  expect(panes.get('second','map')).toEqual(beta);
  panes.forgetContext('second'); second();expect(panes.get('second','map')).toBeUndefined();
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
