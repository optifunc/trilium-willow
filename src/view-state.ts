import type { MindMapEditor, MindMapNode, Selection, Viewport } from '@mindmap/widget';

export interface SavedView { version: 1; centerX: number; centerY: number; zoom: number; selection?: Selection; }
export const defaultView: SavedView = { version: 1, centerX: 0, centerY: 0, zoom: 1 };
export function parseView(raw: string | null): SavedView | undefined {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (v?.version === 1 && [v.centerX, v.centerY, v.zoom].every(Number.isFinite)
      && v.zoom >= .25 && v.zoom <= 4) {
      const view: SavedView = { version: 1, centerX: v.centerX, centerY: v.centerY, zoom: v.zoom };
      if (Array.isArray(v.selection?.ids) && v.selection.ids.every((id: unknown) => typeof id === 'string')
        && (v.selection.activeId === undefined || typeof v.selection.activeId === 'string'))
        view.selection = { ids: [...v.selection.ids], activeId: v.selection.activeId };
      return view;
    }
  } catch { /* Old or unavailable local state uses the default view. */ }
}
export function captureView(view: Viewport, width: number, height: number): SavedView {
  return { version: 1, centerX: (width / 2 - view.x) / view.zoom, centerY: (height / 2 - view.y) / view.zoom, zoom: view.zoom };
}
export function viewKey(noteId: string) { return `trilium-willow:view:v1:${noteId}`; }

/** Pane defaults survive wrapper replacement; a newly opened context uses local storage. */
export class PaneViews {
  private records = new Map<string, { contextId: string; value?: SavedView; read?: () => SavedView }>();
  private key(contextId: string, noteId: string) { return JSON.stringify([contextId, noteId]); }
  get(contextId: string, noteId: string) {
    const record = this.records.get(this.key(contextId, noteId));
    return record?.read?.() ?? record?.value;
  }
  attach(contextId: string, noteId: string, read: () => SavedView) {
    const key = this.key(contextId, noteId), record = { contextId, read, value: undefined as SavedView | undefined };
    this.records.set(key, record);
    return () => {
      // A replacement can mount before the outgoing component is cleaned up.
      if (this.records.get(key) !== record) return;
      record.value = read();
      this.records.set(key, { contextId, value: record.value });
    };
  }
  forgetContext(contextId: string) {
    for (const [key, record] of this.records) if (record.contextId === contextId) this.records.delete(key);
  }
}
const paneKey = Symbol.for('trilium-willow.pane-views');
const shared = globalThis as typeof globalThis & { [paneKey]?: PaneViews };
export const paneViews = shared[paneKey] ??= new PaneViews();

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
  private unsubscribeSelection: () => void;
  constructor(private editor: MindMapEditor, private element: HTMLElement, private noteId: string,
    initial?: SavedView) {
    let saved;
    try { saved = parseView(localStorage.getItem(viewKey(noteId))); } catch { /* Storage may be unavailable. */ }
    this.view = initial ?? saved ?? { ...defaultView };
    this.restoreSelection(this.view.selection);
    this.unsubscribeSelection = editor.on('selectionchange', ({ origin }) => {
      if (this.restoring || origin !== 'user' && !this.interacted) return;
      this.interacted = true;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.persist(), 250);
    });
    this.unsubscribe = editor.on('viewportchange', ({ origin }) => {
      if (this.restoring || !this.width || !this.height) return;
      this.view = captureView(editor.getViewport(), this.width, this.height);
      if (origin === 'user') this.interacted = true;
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
  restoreSelection(selection?: Selection) {
    // Filter before calling the widget, whose public API rejects unknown IDs.
    // setSelection does not reveal nodes or alter the remembered viewport.
    const root = this.editor.getDocument().root;
    const visible = new Set<string>();
    const stack: MindMapNode[] = [root];
    while (stack.length) {
      const node = stack.pop()!;
      visible.add(node.id);
      if (!node.collapsed) stack.push(...node.children);
    }
    const ids = [...new Set(selection?.ids)].filter(id => visible.has(id));
    if (!ids.length) ids.push(root.id);
    const activeId = selection?.activeId && ids.includes(selection.activeId) ? selection.activeId : ids[0];
    this.editor.setSelection(ids, activeId);
  }
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
    return { ...this.view, selection: this.editor.getSelection() };
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
    this.unsubscribeSelection();
    return this.snapshot();
  }
}
