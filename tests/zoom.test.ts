import { expect, it } from 'vitest';
import { displayedZoom, steppedZoom, willowZoom } from '../src/zoom';
import { defaultView, parseView } from '../src/view-state';

it('uses 143% scene scale for Willow defaults and displayed 100%', () => {
  expect(defaultView.zoom).toBe(1.43);
  expect(displayedZoom(1.43)).toBe(1);
  expect(displayedZoom(willowZoom.min)).toBe(.25);
  expect(displayedZoom(willowZoom.max)).toBe(4);
});
it('steps by ten displayed points without discarding fit precision, and clamps both ends', () => {
  expect(steppedZoom(1.43, 1)).toBe(1.573);
  expect(steppedZoom(.532146, 1)).toBe(.675146);
  expect(steppedZoom(steppedZoom(.532146, 1), -1)).toBe(.532146);
  expect(steppedZoom(.4, -1)).toBe(.3575);
  expect(steppedZoom(5.7, 1)).toBe(5.72);
});
it('keeps actual saved scales and centers, accepts the expanded range, and clamps legacy low zoom', () => {
  const saved = { version: 1, centerX: 50, centerY: -25, zoom: 1.43 };
  for (const zoom of [1, 1.43, 4, 5.72])
    expect(parseView(JSON.stringify({ ...saved, zoom }))).toEqual({ ...saved, zoom });
  expect(parseView(JSON.stringify({ ...saved, zoom: .25 }))).toEqual({ ...saved, zoom: .3575 });
  expect(parseView(JSON.stringify({ ...saved, zoom: 6 }))).toBeUndefined();
});
