// Stock Trilium 0.105 exposes each native tree row through Fancytree's li.ftnode.
// Keep one listener across shared-bundle executions, including time between maps.
interface Candidate {
  noteId: string;
  active(): boolean;
  element(): HTMLElement | null;
}
interface TreeFocus {
  register(candidate: Candidate): () => void;
}
type TreeRow = HTMLElement & { ftnode?: { data: { noteId?: string } } };

function treeNote(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return;
  const title = target.closest('.fancytree-title, .fancytree-custom-icon');
  return (title?.closest('li') as TreeRow | null)?.ftnode?.data.noteId;
}

function createTreeFocus(): TreeFocus {
  const candidates = new Set<Candidate>();
  let pending: { noteId: string; until: number } | undefined;
  let frame = 0;
  function cancel() { pending = undefined; cancelAnimationFrame(frame); }
  function attempt() {
    if (!pending) return;
    if (performance.now() > pending.until) { cancel(); return; }
    for (const candidate of candidates) {
      if (candidate.noteId !== pending.noteId || !candidate.active()) continue;
      const element = candidate.element();
      if (!element?.isConnected || !element.checkVisibility()
        || element.parentElement?.dataset.ready !== 'true') continue;
      cancel();
      element.focus({ preventScroll: true });
      return;
    }
    frame = requestAnimationFrame(attempt);
  }
  function request(noteId: string) {
    cancel();
    pending = { noteId, until: performance.now() + 5000 };
    frame = requestAnimationFrame(attempt);
  }
  document.addEventListener('pointerdown', cancel, true);
  document.addEventListener('keydown', cancel, true);
  document.addEventListener('focusin', event => {
    if (pending && treeNote(event.target) !== pending.noteId) cancel();
  }, true);
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const noteId = treeNote(event.target);
    if (noteId) request(noteId);
  }, true);
  // The first Willow click can precede loading this shared bundle. Only adopt
  // focus still in that tree row; a title/input focused since the click wins.
  const initial = treeNote(document.activeElement);
  if (initial) request(initial);
  return { register(candidate) { candidates.add(candidate); return () => { candidates.delete(candidate); }; } };
}

const key = Symbol.for('trilium-willow.tree-focus');
const shared = globalThis as typeof globalThis & { [key]?: TreeFocus };
export const treeFocus = shared[key] ??= createTreeFocus();
