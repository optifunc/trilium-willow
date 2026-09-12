import { MindMapEditor } from '@mindmap/widget';
import widgetStyles from '@mindmap/widget/styles.css?inline';
import { h, useRef, useState, useEffect, useLayoutEffect, useNoteContext,
  useNoteBlob, useEffectiveReadOnly, useTriliumEvent } from 'trilium:preact';
import { showConfirmDialog } from 'trilium:api';
import type { Note, NoteContext } from 'trilium:preact';
import { parseDocument, serializeDocument } from './document';
import { SaveSession } from './save-session';
import { CreationSession } from './create-session';
import { ViewMemory, type SavedView } from './view-state';
import { createMap, newNoteId, readContent, writeContent, type CreateRequest } from './host';

const key = Symbol.for('trilium-willow.spike');
interface View {
  noteId: string; host: HTMLElement; editor: MindMapEditor;
  flush(): Promise<void>; grant(writable: boolean): void;
}
interface Diagnostics {
  mounted: number; destroyed: number; active: Map<string, View>;
  writers: Map<string, string>; sessions: Map<string, SaveSession>; transfers: Set<string>;
  unloadRegistered?: boolean;
  creations?: Map<string, CreationSession>;
}
const shared = globalThis as typeof globalThis & { [key]?: Diagnostics };
const diagnostics: Diagnostics = shared[key] ??= {
  mounted: 0, destroyed: 0, active: new Map(), writers: new Map(), sessions: new Map(), transfers: new Set(),
};
// These remain in memory across pane removal; no map drafts go into local storage.
if (!diagnostics.sessions) diagnostics.sessions = new Map();
if (!diagnostics.transfers) diagnostics.transfers = new Set();
diagnostics.creations ??= new Map();
if (!diagnostics.unloadRegistered) {
  diagnostics.unloadRegistered = true;
  window.addEventListener('beforeunload', event => {
    if ([...diagnostics.sessions.values()].some(s => s.dirty || s.saving || s.editing || s.incoming !== undefined)) {
      event.preventDefault(); event.returnValue = '';
    }
  });
}

const styles = `${widgetStyles}
.willow-spike { display:flex; flex-direction:column; min-height:160px; height:var(--willow-pane-height,420px); }
.willow-spike-bar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:8px; }
.willow-spike-host { flex:1; min-height:0; position:relative; }
.willow-spike-error, .willow-create { padding:12px; color:var(--main-text-color); }
.willow-source { width:100%; min-height:120px; }
.willow-spike .mindmap { --mindmap-background:var(--main-background-color,#fff); --mindmap-text-color:var(--main-text-color,#111); }
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

function NewMapForm({ note, noteContext }: { note: Note; noteContext?: NoteContext }) {
  const model = useRef(diagnostics.creations!.get(note.noteId) ?? new CreationSession(createMap)).current;
  diagnostics.creations!.set(note.noteId, model);
  const [, redraw] = useState(0);
  useLayoutEffect(() => model.subscribe(() => redraw(n => n + 1)), []);
  const readonly = useEffectiveReadOnly(note, noteContext);
  async function create(event: Event) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget as HTMLFormElement).get('mapTitle') ?? model.request?.title ?? '').trim();
    if (!readonly) await model.submit(note.noteId, parentId(note, noteContext), title);
  }
  return h('form', { class: 'willow-create', onSubmit: create },
    h('style', null, styles),
    h('h3', null, 'Create a mind map'),
    h('p', null, 'The new map will appear beside this note.'),
    h('label', null, 'Map title ', h('input', { name: 'mapTitle', defaultValue: model.title, required: true,
      'aria-label': 'Map title', disabled: model.busy || !!model.request,
      onInput: (event: Event) => {
        model.title = (event.target as HTMLInputElement).value;
        event.stopPropagation();
      } })),
    h('button', { type: 'submit', disabled: model.busy || readonly }, model.busy ? 'Creating…' : model.error ? 'Retry creation' : 'Create map'),
    model.created && h('p', { role: 'status' }, 'Created. ', h('a', { href: `#root/${parentId(note, noteContext)}/${model.created}` }, 'Open new map')),
    model.error && h('p', { role: 'alert' }, model.error));
}

function NotePane() {
  const { note, noteContext } = useNoteContext();
  if (!note || note.type !== 'render') return null;
  const props = { key: `${noteContext?.ntxId}:${note.noteId}`, note, noteContext };
  return note.hasLabel('willowLauncher') ? h(NewMapForm, props) : h(MapPane, props);
}

function MapPane({ note, noteContext }: { note: Note; noteContext?: NoteContext }) {
  const host = useRef<HTMLDivElement | null>(null);
  const editor = useRef<MindMapEditor | null>(null);
  const memory = useRef<ViewMemory | undefined>(undefined);
  const view = useRef<SavedView | undefined>(undefined);
  const displayed = useRef<string | undefined>(undefined);
  const applying = useRef(false);
  const disposed = useRef(false);
  const composing = useRef(false);
  const instanceId = useRef(crypto.randomUUID());
  const session = useRef(diagnostics.sessions.get(note.noteId) ?? new SaveSession(
    () => readContent(note.noteId), content => writeContent(note.noteId, content))).current;
  diagnostics.sessions.set(note.noteId, session);
  const [ownsEdit, setOwnsEdit] = useState(false);
  const [, redraw] = useState(0);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [source, setSource] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [recovered, setRecovered] = useState<string>();
  const recovery = useRef<CreateRequest | undefined>(undefined);
  const readonly = useEffectiveReadOnly(note, noteContext);
  const readonlyRef = useRef(readonly);
  readonlyRef.current = readonly || !ownsEdit;
  const blob = useNoteBlob(note);

  function commitEdit() {
    if (composing.current) throw new Error('Finish text composition before leaving the map.');
    host.current?.querySelector('textarea')?.blur();
  }
  async function flush() {
    commitEdit();
    await session.flush();
  }
  useTriliumEvent('beforeNoteSwitch', async ({ noteContext: target }) => {
    if (target.ntxId === noteContext?.ntxId) {
      if (busyRef.current) throw new Error('Wait for map recovery to finish.');
      await flush();
    }
  });
  useTriliumEvent('beforeNoteContextRemove', async ({ ntxIds }) => {
    if (ntxIds.includes(noteContext?.ntxId)) {
      if (busyRef.current) throw new Error('Wait for map recovery to finish.');
      await flush();
    }
  });

  function destroy() {
    if (!editor.current) return;
    view.current = memory.current?.destroy(); memory.current = undefined;
    editor.current.destroy(); editor.current = null;
    diagnostics.destroyed++;
    diagnostics.active.delete(instanceId.current);
  }
  function install(content: string) {
    if (!host.current || disposed.current) return;
    try {
      applying.current = true;
      const document = parseDocument(content);
      if (editor.current) {
        let replacementError: string | undefined;
        const unsubscribe = editor.current.on('error', ({ message }) => { replacementError = message; });
        try { editor.current.setDocument(document); } finally { unsubscribe(); }
        if (replacementError) throw new Error(replacementError);
      } else {
        editor.current = new MindMapEditor(host.current, { document, readonly: readonlyRef.current });
        diagnostics.mounted++;
        diagnostics.active.set(instanceId.current, { noteId: note.noteId, host: host.current, editor: editor.current,
          flush, grant: writable => { readonlyRef.current = readonly || !writable; setOwnsEdit(writable); } });
        memory.current = new ViewMemory(editor.current, host.current.querySelector('.mindmap')!, note.noteId, view.current);
        editor.current.on('documentchange', ({ document, reason }) => {
          if (applying.current || reason === 'replacement') return;
          displayed.current = serializeDocument(document);
          session.change(displayed.current);
        });
        editor.current.on('editstart', () => { if (!readonlyRef.current) session.editing = true; });
        editor.current.on('editcommit', () => { session.editing = false; });
        editor.current.on('editcancel', () => { session.editing = false; });
        editor.current.on('error', ({ message }) => setError(message));
      }
      displayed.current = content;
      setInvalid(false); setError('');
    } catch (e) {
      destroy(); displayed.current = content;
      setInvalid(true); setError(String(e));
    } finally { applying.current = false; }
  }
  function sync() {
    if (disposed.current) return;
    if (session.local !== undefined && session.local !== displayed.current) install(session.local);
    if (diagnostics.writers.get(note.noteId) === instanceId.current)
      noteContext?.setContextData('saveState', { state: session.state === 'conflict' ? 'error' : session.state });
    redraw(n => n + 1);
  }

  useLayoutEffect(() => {
    disposed.current = false;
    if (!diagnostics.writers.has(note.noteId)) {
      diagnostics.writers.set(note.noteId, instanceId.current);
      readonlyRef.current = readonly; session.writable = !readonly;
      setOwnsEdit(true);
    }
    const unsubscribe = session.subscribe(sync);
    sync();
    const section = host.current!.parentElement!;
    const container = section.closest('.scrolling-container');
    const size = () => {
      if (container && container.clientHeight > 0) section.style.setProperty('--willow-pane-height', `${Math.max(160, container.clientHeight - 8)}px`);
    };
    const resize = new ResizeObserver(size);
    if (container) resize.observe(container);
    size();
    return () => {
      resize.disconnect(); unsubscribe();
      try { commitEdit(); void session.flush().catch(() => {}); }
      finally {
        disposed.current = true; destroy();
        if (diagnostics.writers.get(note.noteId) === instanceId.current) diagnostics.writers.delete(note.noteId);
      }
    };
  }, []);

  useEffect(() => {
    if (blob?.content !== undefined) session.receive(blob.content);
  }, [blob]);
  useEffect(() => {
    if (diagnostics.writers.get(note.noteId) === instanceId.current) session.writable = !readonly;
    if (!editor.current || session.local === undefined) return;
    commitEdit(); destroy(); install(session.local);
  }, [readonly, ownsEdit]);

  async function takeEditing() {
    if (diagnostics.transfers.has(note.noteId)) return;
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
    if (busyRef.current || readonlyRef.current) return;
    if (!keep && !await showConfirmDialog('Discard your local changes and load the saved original?')) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      commitEdit(); await session.settle();
      if (keep) {
        if (recovery.current?.content !== session.local) recovery.current = undefined;
        recovery.current ??= { sourceId: note.noteId, parentId: parentId(note, noteContext), noteId: newNoteId(),
          title: `${note.title} (recovered)`, content: session.local! };
        const id = await createMap(recovery.current);
        setRecovered(id);
        if (session.local !== recovery.current.content) throw new Error('The draft changed during recovery. Keep both again to preserve the latest edits.');
      }
      await session.useIncoming();
      recovery.current = undefined;
    } catch (e) { setError(`Recovery did not finish. Your local draft is retained; retry is available. ${String(e)}`); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const stateText = { loading: 'Loading…', saved: 'Saved', unsaved: 'Unsaved', saving: 'Saving…', error: 'Save failed', conflict: 'External change — saving paused' }[session.state];
  const conflict = session.incoming !== undefined;
  const interaction = () => memory.current?.interaction();
  return h('section', { class: 'willow-spike', 'data-note-id': note.noteId, 'data-willow-context': noteContext?.ntxId },
    h('style', null, styles),
    h('div', { class: 'willow-spike-bar' },
      h('button', { onClick: () => { interaction(); editor.current?.fit(); } }, 'Fit map'),
      h('button', { disabled: busy || conflict || readonlyRef.current, onClick: async () => {
        try { await flush(); setError(''); } catch (e) { setError(String(e)); }
      } }, session.state === 'error' ? 'Retry save' : 'Save'),
      !ownsEdit && !readonly && h('button', { onClick: takeEditing }, 'Edit in this pane'),
      !readonly && h('button', { onClick: () => setCreating(!creating) }, 'New map'),
      h('span', { role: 'status' }, invalid ? 'Cannot load' : readonlyRef.current ? 'Read-only' : stateText)),
    creating && h(NewMapForm, { note, noteContext }),
    (error || conflict || session.error) && h('div', { class: 'willow-spike-error', role: 'alert' },
      conflict ? 'Another version arrived. Keep both saves your local work as a sibling map, then loads the saved original.' : error || session.error,
      conflict && error && h('p', null, error),
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
