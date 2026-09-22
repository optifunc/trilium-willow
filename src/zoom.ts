import type { ZoomOptions } from '@mindmap/widget';

/** Willow's displayed 100% uses the widget's unchanged geometry at scale 1.43. */
export const willowZoom: Readonly<ZoomOptions> = { default: 1.43, min: 1.43 * .25, max: 1.43 * 4 };
export const displayedZoom = (zoom: number): number => zoom / willowZoom.default;
export const clampZoom = (zoom: number): number => Math.max(willowZoom.min, Math.min(willowZoom.max, zoom));
export function steppedZoom(zoom: number, direction: -1 | 1): number {
  return clampZoom(Number((zoom + direction * willowZoom.default * .1).toFixed(10)));
}
