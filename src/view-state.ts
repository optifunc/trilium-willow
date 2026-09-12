import type { MindMapEditor, Viewport } from '@mindmap/widget';

export interface SavedView { version: 1; centerX: number; centerY: number; zoom: number; }
export const defaultView: SavedView = { version: 1, centerX: 0, centerY: 0, zoom: 1 };
export function parseView(raw: string | null): SavedView | undefined {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (v?.version === 1 && [v.centerX, v.centerY, v.zoom].every(Number.isFinite)
      && v.zoom >= .25 && v.zoom <= 4) return v;
  } catch { /* Old or unavailable local state uses the default view. */ }
}
export function captureView(view: Viewport, width: number, height: number): SavedView {
  return { version: 1, centerX: (width / 2 - view.x) / view.zoom, centerY: (height / 2 - view.y) / view.zoom, zoom: view.zoom };
}
export function viewKey(noteId: string) { return `trilium-willow:view:v1:${noteId}`; }

/** Each instance keeps its own centre; only interactions update the next-open default. */
export class ViewMemory {
  private view: SavedView;
  private width = 0;
  private height = 0;
  private restoring = false;
  private interacted = false;
  private timer?: ReturnType<typeof setTimeout>;
  private observer: ResizeObserver;
  private unsubscribe: () => void;
  constructor(private editor: MindMapEditor, private element: HTMLElement, private noteId: string,
    initial?: SavedView) {
    let saved;
    try { saved = parseView(localStorage.getItem(viewKey(noteId))); } catch { /* Storage may be unavailable. */ }
    this.view = initial ?? saved ?? { ...defaultView };
    this.unsubscribe = editor.on('viewportchange', () => {
      if (this.restoring || !this.width || !this.height) return;
      this.view = captureView(editor.getViewport(), this.width, this.height);
      if (this.interacted) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.persist(), 250);
      }
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(element);
    this.resize();
  }
  interaction() { this.interacted = true; }
  private resize() {
    const { clientWidth: width, clientHeight: height } = this.element;
    if (!width || !height || (width === this.width && height === this.height)) return;
    this.width = width; this.height = height;
    this.restoring = true;
    this.editor.setZoom(this.view.zoom);
    this.editor.panTo(width / 2 - this.view.centerX * this.view.zoom, height / 2 - this.view.centerY * this.view.zoom);
    this.restoring = false;
  }
  snapshot() {
    if (this.width && this.height) this.view = captureView(this.editor.getViewport(), this.width, this.height);
    return { ...this.view };
  }
  private persist() {
    if (!this.interacted) return;
    try { localStorage.setItem(viewKey(this.noteId), JSON.stringify(this.snapshot())); } catch { /* Editing remains available. */ }
    this.interacted = false;
  }
  destroy() {
    clearTimeout(this.timer);
    this.persist();
    this.observer.disconnect();
    this.unsubscribe();
    return this.snapshot();
  }
}
