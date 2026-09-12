import type { NoteContext } from 'trilium:preact';

const key = Symbol.for('trilium-willow.previews');
const shared = globalThis as typeof globalThis & { [key]?: Map<string, () => void> };
const previews = shared[key] ??= new Map();

export function clearPreview(contextId: string) { previews.get(contextId)?.(); }

/** Keep the last painted canvas until the host's replacement is ready to paint. */
export function retainPreview(host: HTMLElement, context: NoteContext, styles: string) {
  clearPreview(context.ntxId);
  const container = host.closest<HTMLElement>('.scrolling-container');
  if (!container || !host.clientWidth || !host.clientHeight || host.dataset.ready !== 'true') return;
  const sourceId = context.note?.noteId;
  const box = host.getBoundingClientRect(), parent = container.getBoundingClientRect();
  const preview = document.createElement('div');
  preview.className = 'willow-transition render-note-scope';
  preview.inert = true;
  preview.setAttribute('aria-hidden', 'true');
  const stylesheet = document.createElement('style'); stylesheet.textContent = styles;
  const canvas = host.cloneNode(true) as HTMLElement;
  // No duplicate accessibility/DOM identities in the temporary, inert picture.
  for (const element of canvas.querySelectorAll('[id], [aria-owns], [aria-activedescendant]')) {
    element.removeAttribute('id'); element.removeAttribute('aria-owns'); element.removeAttribute('aria-activedescendant');
  }
  Object.assign(canvas.style, { width: '100%', height: '100%' });
  Object.assign(preview.style, { position: 'absolute', pointerEvents: 'none', zIndex: '2',
    left: `${box.left - parent.left + container.scrollLeft}px`, top: `${box.top - parent.top + container.scrollTop}px`,
    width: `${box.width}px`, height: `${box.height}px` });
  const position = container.style.position;
  const positioned = getComputedStyle(container).position === 'static';
  if (positioned) container.style.position = 'relative';
  preview.append(stylesheet, canvas);
  container.append(preview);
  const clear = () => {
    observer.disconnect(); clearTimeout(timeout); preview.remove();
    if (positioned && container.style.position === 'relative') container.style.position = position;
    if (previews.get(context.ntxId) === clear) previews.delete(context.ntxId);
  };
  const observer = new MutationObserver(() => {
    if (!container.isConnected) { clear(); return; }
    const note = context.note;
    if (note?.noteId === sourceId && host.isConnected) return;
    if (note?.type !== 'render' || !note.hasLabel('willowMindMap')
      || container.querySelector('.render-error-card, .willow-spike-error')) clear();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timeout = setTimeout(clear, 5000);
  previews.set(context.ntxId, clear);
}
