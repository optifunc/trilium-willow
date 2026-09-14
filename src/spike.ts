import { MindMapEditor } from '@mindmap/widget';
import widgetStyles from '@mindmap/widget/styles.css?inline';
import { h, useRef, useState, useEffect, useLayoutEffect, useNoteContext,
  useNoteBlob, useEffectiveReadOnly, useTriliumEvent } from 'trilium:preact';
import { originEntity, showConfirmDialog } from 'trilium:api';
import type { Note, NoteContext } from 'trilium:preact';
import { parseDocument, serializeDocument, initializeTemplate } from './document';
import { clearPreview, retainPreview } from './presentation';
import { treeFocus } from './tree-focus';
import { TitleSession } from './title-session';
import { paneViews, ViewMemory, type SavedView } from './view-state';
import { createMap, newNoteId, readContent, writeContent, readTitle, writeTitle } from './host';

const key = Symbol.for('trilium-willow.spike');
interface View {
  noteId: string; host: HTMLElement; editor: MindMapEditor;
  flush(): Promise<void>; grant(writable: boolean): void;
}
interface Diagnostics {
  mounted: number; destroyed: number; active: Map<string, View>;
  writers: Map<string, string>; sessions: Map<string, TitleSession>; transfers: Set<string>;
  unloadRegistered?: boolean;
}
const shared = globalThis as typeof globalThis & { [key]?: Diagnostics };
const diagnostics: Diagnostics = shared[key] ??= {
  mounted: 0, destroyed: 0, active: new Map(), writers: new Map(), sessions: new Map(), transfers: new Set(),
};
// These remain in memory across pane removal; no map drafts go into local storage.
if (!diagnostics.sessions) diagnostics.sessions = new Map();
if (!diagnostics.transfers) diagnostics.transfers = new Set();
if (!diagnostics.unloadRegistered) {
  diagnostics.unloadRegistered = true;
  window.addEventListener('beforeunload', event => {
    if ([...diagnostics.sessions.values()].some(s => s.dirty || s.saving || s.editing || s.recovering || s.incoming !== undefined)) {
      // Match Trilium's save-before-close contract: finish labels and start the
      // writes, but keep this close/reload blocked until they are acknowledged.
      for (const [id, view] of diagnostics.active) {
        if (diagnostics.writers.get(view.noteId) === id) void view.flush().catch(() => {});
      }
      for (const session of diagnostics.sessions.values()) {
        if (session.dirty && !session.editing && !session.saving && !session.recovering)
          void session.flush().catch(() => {});
      }
      event.preventDefault(); event.returnValue = '';
    }
  });
}

const styles = `${widgetStyles}
.willow-spike { display:flex; flex-direction:column; min-height:160px; height:var(--willow-pane-height,420px); }
.willow-spike-host { flex:1; min-height:0; position:relative; }
.willow-spike-error, .willow-notice { padding:12px; color:var(--main-text-color); }
.willow-spike-host:not([data-ready="true"]) { visibility:hidden; }
.willow-source { width:100%; min-height:120px; }
.willow-spike .mindmap, .willow-transition .mindmap {
  --mindmap-background:var(--main-background-color,#fff); --mindmap-text-color:var(--main-text-color,#111);
  --mindmap-selection-color:#d2d2d2; --mindmap-focus-color:var(--main-text-color,#777);
}
.willow-spike .mindmap:is(.dark-theme *), .willow-transition .mindmap:is(.dark-theme *) {
  --mindmap-selection-color:var(--accented-background-color,#555);
}
.willow-spike .mindmap-editor, .willow-spike .mindmap-drag-image {
  background:var(--main-background-color,#fff); color:var(--main-text-color,#111);
}
.willow-spike .mindmap-menu { background:var(--main-background-color,#fff); color:var(--main-text-color,#111); }
.willow-spike .mindmap-menu-shortcut { color:inherit; opacity:.75; }
.willow-spike .mindmap-menu button:hover, .willow-spike .mindmap-menu-navigated button:focus { background:var(--accented-background-color,#e5e5e5); }
`;

export default function WillowSpike() {
  const boundary = useRef<HTMLDivElement | null>(null);
  const [attached, setAttached] = useState(true);
  useLayoutEffect(() => {
    const element = boundary.current!;
    // Trilium 0.105 can remove a nested JSX root without calling Preact unmount.
    const observer = new MutationObserver(() => {
      if (!element.isConnected) { observer.disconnect(); setAttached(false); }
    });
    observer.observe(element.ownerDocument.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); };
  }, []);
  return h('div', { ref: boundary, class: 'willow-spike-boundary render-note-scope' }, attached && h(NotePane, null));
}

function parentId(note: Note, context?: NoteContext) {
  const path = context?.notePath?.split('/');
  const parent = path?.at(-2);
  const parents = note.getParentNoteIds();
  const id = parent && parents.includes(parent) ? parent : parents[0];
  if (!id) throw new Error('This map has no available parent note.');
  return id;
}

function NotePane() {
  const { noteContext } = useNoteContext();
  // Render Note roots can receive navigation events before Trilium removes them.
  // Pin once to the synchronous context, not the hook's lagging note. Trilium
  // can also finish an older bundle request after opening a different Willow
  // document. The same shared editor can serve that current document safely.
  const note = useRef(noteContext?.note?.type === 'render'
    && noteContext.note.hasLabel('willowMindMap')
    && noteContext.note.getRelationValue('renderNote') === originEntity.getRelationValue('renderNote')
    ? noteContext.note : originEntity).current;
  if (!noteContext || noteContext.note?.noteId !== note.noteId || note.type !== 'render') return null;
  if (note.hasOwnedLabel('template')) return h('p', { class: 'willow-notice' },
    'Create a map from the note tree: Insert note after or Insert child note → Willow Mind Map.');
  return h(MapPane, { key: `${noteContext.ntxId}:${note.noteId}`, note, noteContext });
}

function MapPane({ note, noteContext }: { note: Note; noteContext?: NoteContext }) {
  const host = useRef<HTMLDivElement | null>(null);
  const editor = useRef<MindMapEditor | null>(null);
  const memory = useRef<ViewMemory | undefined>(undefined);
  const releaseView = useRef<(() => void) | undefined>(undefined);
  const mountedReadonly = useRef<boolean | undefined>(undefined);
  const view = useRef<SavedView | undefined>(undefined);
  const displayed = useRef<string | undefined>(undefined);
  const applying = useRef(false);
  const disposed = useRef(false);
  const composing = useRef(false);
  const instanceId = useRef(crypto.randomUUID());
  const session = useRef(diagnostics.sessions.get(note.noteId) ?? new TitleSession(note.noteId, note.title,
    () => readContent(note.noteId), content => writeContent(note.noteId, content),
    () => readTitle(note.noteId), title => writeTitle(note.noteId, title))).current;
  diagnostics.sessions.set(note.noteId, session);
  const [ownsEdit, setOwnsEdit] = useState(() => !diagnostics.writers.has(note.noteId));
  const [, redraw] = useState(0);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [source, setSource] = useState(false);
  const busy = session.recovering;
  const recovered = session.recovered;
  const readonly = useEffectiveReadOnly(note, noteContext);
  const readonlyRef = useRef(readonly);
  readonlyRef.current = readonly || !ownsEdit;
  const blob = useNoteBlob(note);

  function commitEdit(detached = false) {
    if (composing.current && !detached) throw new Error('Finish text composition before leaving the map.');
    const textarea = host.current?.querySelector('textarea');
    textarea?.blur();
    // Removing a focused element does not dispatch blur. A late host render can
    // detach our root before cleanup runs; finish through the widget's normal
    // blur handler so the detached textarea's last text reaches the save session.
    if (textarea && host.current?.querySelector('textarea') === textarea)
      textarea.dispatchEvent(new FocusEvent('blur'));
  }
  async function flush() {
    const input = document.activeElement;
    if (input instanceof HTMLInputElement && input.matches('.note-title')
      && host.current?.closest('.note-split')?.contains(input)) input.blur();
    commitEdit();
    await session.flush();
  }
  useTriliumEvent('beforeNoteSwitch', async ({ noteContext: target }) => {
    if (target.ntxId === noteContext?.ntxId) {
      if (session.recovering) throw new Error('Wait for map recovery to finish.');
      await flush();
      if (host.current && noteContext) retainPreview(host.current, noteContext, styles);
    }
  });
  useTriliumEvent('beforeNoteContextRemove', async ({ ntxIds }) => {
    if (ntxIds.includes(noteContext?.ntxId)) {
      if (session.recovering) throw new Error('Wait for map recovery to finish.');
      await flush();
      if (noteContext) paneViews.forgetContext(noteContext.ntxId);
    }
  });

  function destroy() {
    if (!editor.current) return;
    if (host.current) host.current.dataset.ready = 'false';
    mountedReadonly.current = undefined;
    releaseView.current?.(); releaseView.current = undefined;
    view.current = memory.current?.destroy(); memory.current = undefined;
    editor.current.destroy(); editor.current = null;
    diagnostics.destroyed++;
    diagnostics.active.delete(instanceId.current);
  }
  function install(content: string) {
    if (!host.current || disposed.current) return;
    // Render Notes can mount while their host is display:none after a text note.
    // Measuring then caches 1px labels. Wait for the ResizeObserver's visible size.
    if (!host.current.clientWidth || !host.current.clientHeight) return;
    try {
      applying.current = true;
      const map = parseDocument(initializeTemplate(content, note.noteId));
      if (editor.current) {
        const selection = editor.current.getSelection();
        let replacementError: string | undefined;
        const unsubscribe = editor.current.on('error', ({ message }) => { replacementError = message; });
        try {
          editor.current.setDocument(map);
          memory.current?.restoreSelection(selection);
        } finally { unsubscribe(); }
        if (replacementError) throw new Error(replacementError);
      } else {
        editor.current = new MindMapEditor(host.current, { document: map, readonly: readonlyRef.current });
        mountedReadonly.current = readonlyRef.current;
        diagnostics.mounted++;
        diagnostics.active.set(instanceId.current, { noteId: note.noteId, host: host.current, editor: editor.current,
          flush, grant: writable => { readonlyRef.current = readonly || !writable; setOwnsEdit(writable); } });
        memory.current = new ViewMemory(editor.current, host.current.querySelector('.mindmap')!, note.noteId,
          view.current ?? (noteContext && paneViews.get(noteContext.ntxId, note.noteId)));
        if (noteContext) {
          const instanceMemory = memory.current;
          releaseView.current = paneViews.attach(noteContext.ntxId, note.noteId, () => instanceMemory.snapshot());
        }
        editor.current.on('documentchange', ({ document, reason }) => {
          if (applying.current || reason === 'replacement') return;
          displayed.current = serializeDocument(document);
          session.change(displayed.current);
        });
        editor.current.on('editstart', () => { if (!readonlyRef.current) session.editing = true; });
        editor.current.on('editcommit', () => { session.editing = false; });
        editor.current.on('editcancel', () => { session.editing = false; });
        editor.current.on('error', ({ message }) => setError(message));
        const instance = editor.current;
        const reveal = () => {
            if (disposed.current || editor.current !== instance || !host.current?.isConnected
              || !host.current.clientWidth || !host.current.clientHeight) return;
            instance.refreshLayout();
            host.current.dataset.ready = 'true';
            if (noteContext) clearPreview(noteContext.ntxId);
        };
        if (document.fonts.status === 'loaded') reveal();
        else void document.fonts.ready.then(reveal);
      }
      displayed.current = content;
      setInvalid(false); setError('');
      session.validate();
    } catch (e) {
      session.invalidate();
      destroy(); displayed.current = content;
      setInvalid(true); setError(String(e));
      if (noteContext) clearPreview(noteContext.ntxId);
    } finally { applying.current = false; }
  }
  function sync() {
    if (disposed.current) return;
    // The shared title session aligns a validated map on its first writable open.
    if (session.local !== undefined && session.local !== displayed.current) install(session.local);
    if (noteContext?.note?.noteId === note.noteId && session.state !== 'loading')
      noteContext.setContextData('saveState', { state: session.state === 'conflict' ? 'error' : session.state });
    redraw(n => n + 1);
  }

  useLayoutEffect(() => {
    disposed.current = false;
    const unregisterFocus = treeFocus.register({
      noteId: note.noteId,
      active: () => !!noteContext?.isActive() && noteContext.note?.noteId === note.noteId,
      element: () => host.current?.querySelector<HTMLElement>('.mindmap') ?? null,
    });
    if (!diagnostics.writers.has(note.noteId)) {
      diagnostics.writers.set(note.noteId, instanceId.current);
      readonlyRef.current = readonly; session.writable = !readonly;
      setOwnsEdit(true);
    } else {
      readonlyRef.current = true;
      setOwnsEdit(false);
    }
    const section = host.current!.parentElement!;
    const split = section.closest('.note-split');
    const titleFocus = (event: Event) => {
      if (noteContext?.note?.noteId !== note.noteId) return;
      const input = event.target;
      if (input instanceof HTMLInputElement && input.matches('.note-title'))
        session.editTitle(event.type === 'focusin', input.value);
    };
    split?.addEventListener('focusin', titleFocus);
    split?.addEventListener('focusout', titleFocus);
    if (split?.contains(document.activeElement) && document.activeElement?.matches('input.note-title')) session.editTitle(true);
    session.receiveTitle(note.title);
    const container = section.closest('.scrolling-container');
    const size = () => {
      if (container && container.clientHeight > 0) section.style.setProperty('--willow-pane-height', `${Math.max(160, container.clientHeight - 8)}px`);
    };
    let visible = false;
    const resize = new ResizeObserver(() => {
      size();
      const measurable = !!host.current?.clientWidth && !!host.current?.clientHeight;
      if (measurable && !visible) {
        // Recalculate after every hidden-to-visible transition, even at the same size.
        if (editor.current) {
          editor.current.refreshLayout();
          host.current!.dataset.ready = 'true';
          if (noteContext) clearPreview(noteContext.ntxId);
        }
        sync();
      }
      visible = measurable;
    });
    if (container) resize.observe(container);
    resize.observe(host.current!);
    size();
    const unsubscribe = session.subscribe(sync);
    sync();
    return () => {
      split?.removeEventListener('focusin', titleFocus);
      split?.removeEventListener('focusout', titleFocus);
      unregisterFocus(); resize.disconnect(); unsubscribe();
      try { commitEdit(true); void session.flush().catch(() => {}); }
      finally {
        disposed.current = true; destroy();
        if (diagnostics.writers.get(note.noteId) === instanceId.current) {
          diagnostics.writers.delete(note.noteId);
          // A host replacement may mount its new root before disposing this one.
          // Hand ownership to that replacement in the same pane, not another split.
          const replacement = [...diagnostics.active].find(([, v]) => v.noteId === note.noteId
            && v.host.isConnected && v.host.parentElement?.dataset.willowContext === noteContext?.ntxId);
          if (replacement) {
            diagnostics.writers.set(note.noteId, replacement[0]);
            replacement[1].grant(true);
          }
        }
      }
    };
  }, []);

  useEffect(() => {
    if (blob?.content !== undefined) session.receive(blob.content);
  }, [blob]);
  useLayoutEffect(() => {
    if (diagnostics.writers.get(note.noteId) === instanceId.current) session.writable = !readonly;
    session.align();
    if (!editor.current || session.local === undefined || mountedReadonly.current === readonlyRef.current) return;
    commitEdit(); destroy(); install(session.local);
  }, [readonly, ownsEdit]);

  useTriliumEvent('entitiesReloaded', ({ loadResults }) => {
    if (loadResults.isNoteReloaded(note.noteId)) {
      session.receiveTitle(note.title);
      sync();
    }
  });
  useTriliumEvent('contextDataChanged', ({ noteContext: target, key, value }) => {
    // The native title saver shares this badge. Its acknowledgement must not
    // hide a pending or failed map-content save.
    if (target === noteContext && target.note?.noteId === note.noteId && key === 'saveState'
      && value?.state === 'saved' && session.state !== 'saved' && session.state !== 'loading') {
      target.setContextData('saveState', { state: session.state === 'conflict' ? 'error' : session.state });
    }
  });

  async function takeEditing() {
    if (session.recovering || diagnostics.transfers.has(note.noteId)) return;
    diagnostics.transfers.add(note.noteId);
    try {
      const previous = diagnostics.active.get(diagnostics.writers.get(note.noteId) ?? '');
      await previous?.flush();
      if (disposed.current) return;
      previous?.grant(false);
      diagnostics.writers.set(note.noteId, instanceId.current);
      readonlyRef.current = readonly; session.writable = !readonly;
      setOwnsEdit(true);
    } catch (e) { setError(`Cannot transfer editing: ${String(e)}`); }
    finally { diagnostics.transfers.delete(note.noteId); }
  }

  async function resolve(keep: boolean) {
    if (session.recovering || readonlyRef.current) return;
    setError('');
    try {
      commitEdit();
      await session.useIncoming(keep ? async content => {
        if (session.recoveryRequest?.content !== content) session.recoveryRequest = undefined;
        session.recoveryRequest ??= { sourceId: note.noteId, parentId: parentId(note, noteContext), noteId: newNoteId(),
          title: parseDocument(initializeTemplate(content, note.noteId)).root.text, content };
        session.recovered = await createMap(session.recoveryRequest);
        session.notify();
      } : undefined, keep ? undefined : () => showConfirmDialog('Discard your local changes and load the saved original?'));
    } catch (e) { setError(`Recovery did not finish. Your local draft is retained; retry is available. ${String(e)}`); }
  }
  const conflict = session.incoming !== undefined;
  const interaction = () => memory.current?.interaction();
  return h('section', { class: 'willow-spike', 'data-note-id': note.noteId, 'data-willow-context': noteContext?.ntxId },
    h('style', null, styles),
    !ownsEdit && !readonly && h('div', { class: 'willow-notice' },
      'This map is being edited in another pane. ', h('button', { disabled: busy, onClick: takeEditing }, 'Edit here')),
    (error || conflict || session.error) && h('div', { class: 'willow-spike-error', role: 'alert' },
      conflict ? 'Another version arrived. Keep both saves your local work as a sibling map, then loads the saved original.' : error || session.error,
      conflict && error && h('p', null, error),
      session.state === 'error' && !conflict && !readonlyRef.current && h('button', { disabled: busy, onClick: async () => {
        try { await flush(); setError(''); } catch (e) { setError(String(e)); }
      } }, 'Retry save'),
      (conflict || session.state === 'error') && !readonlyRef.current && h('div', null,
        h('button', { disabled: busy, onClick: () => resolve(true) }, busy ? 'Recovering…' : 'Keep both'),
        h('button', { disabled: busy, onClick: () => resolve(false) }, 'Use incoming')),
      invalid && h('div', null,
        h('button', { onClick: () => setSource(!source) }, 'View original source'),
        h('button', { onClick: async () => {
          try { displayed.current = undefined; await session.useIncoming(); } catch (e) { setError(String(e)); }
        } }, 'Reload saved map'))),
    source && h('textarea', { class: 'willow-source', readOnly: true, 'aria-label': 'Original note source', value: session.local ?? '' }),
    recovered && h('p', null, 'Local work saved: ', h('a', { href: `#root/${parentId(note, noteContext)}/${recovered}` }, 'Open recovery copy')),
    h('div', { key: 'editor-host', ref: host, class: 'willow-spike-host', inert: busy,
      onPointerDownCapture: interaction, onWheelCapture: interaction, onKeyDownCapture: interaction,
      onCompositionStart: () => { composing.current = true; },
      onCompositionEnd: () => { composing.current = false; } }));
}
