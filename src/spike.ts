import { MindMapEditor } from '@mindmap/widget';
import widgetStyles from '@mindmap/widget/styles.css?inline';
import { h, useRef, useState, useEffect, useLayoutEffect, useNoteContext,
  useEditorSpacedUpdate, useEffectiveReadOnly, useTriliumEvent } from 'trilium:preact';
import type { Note, NoteContext } from 'trilium:preact';
import { parseDocument, serializeDocument } from './document';

// Explicit spike instrumentation. No document data or credentials are recorded.
const key = Symbol.for('trilium-willow.spike');
interface View {
  noteId: string; host: HTMLElement; editor: MindMapEditor;
  flush(): Promise<void>; grant(writable: boolean): void;
}
interface Diagnostics {
  mounted: number; destroyed: number; active: Map<string, View>;
  writers: Map<string, string>;
}
const shared = globalThis as typeof globalThis & { [key]?: Diagnostics };
const diagnostics: Diagnostics = shared[key] ??= { mounted: 0, destroyed: 0, active: new Map(), writers: new Map() };

const styles = `${widgetStyles}
.willow-spike { display:flex; flex-direction:column; min-height:160px; height:var(--willow-pane-height,420px); }
.willow-spike-bar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:8px; }
.willow-spike-host { flex:1; min-height:0; position:relative; }
.willow-spike-error { padding:12px; color:var(--main-text-color); }
.willow-spike .mindmap { --mindmap-background:var(--main-background-color,#fff); --mindmap-text-color:var(--main-text-color,#111); }
`;

export default function WillowSpike() {
  const boundary = useRef<HTMLDivElement | null>(null);
  const [attached, setAttached] = useState(true);
  useLayoutEffect(() => {
    // Trilium 0.105 removes a Render Note's nested Preact root using jQuery on
    // tab close. Unmount our entire hook-using subtree when its DOM is detached,
    // even when Trilium does not call Preact's unmount for that nested root.
    const element = boundary.current!;
    const observer = new MutationObserver(() => {
      if (!element.isConnected) { observer.disconnect(); setAttached(false); }
    });
    observer.observe(element.ownerDocument.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  // Trilium rewrites injected CSS into @scope (.render-note-scope). Its JSX
  // path mounts outside the legacy scope container, so supply the scope here.
  return h('div', { ref: boundary, class: 'willow-spike-boundary render-note-scope' }, attached && h(NotePane, null));
}

function NotePane() {
  const { note, noteContext } = useNoteContext();
  if (!note || note.type !== 'render') return null;
  // Separate state and save callbacks for each document, even when Trilium reuses a pane.
  return h(MapPane, { key: `${noteContext?.ntxId}:${note.noteId}`, note, noteContext });
}

function MapPane({ note, noteContext }: { note: Note; noteContext?: NoteContext }) {
  const host = useRef<HTMLDivElement | null>(null);
  const editor = useRef<MindMapEditor | null>(null);
  const committed = useRef<string | undefined>(undefined);
  const acknowledged = useRef<string | undefined>(undefined);
  const pendingContent = useRef<string | undefined>(undefined);
  const applying = useRef(false);
  const disposed = useRef(false);
  const composing = useRef(false);
  const instanceId = useRef(crypto.randomUUID());
  const conflict = useRef(false);
  const [ownsEdit, setOwnsEdit] = useState(false);
  const [status, setStatus] = useState('Loading…');
  const [error, setError] = useState('');
  const readonly = useEffectiveReadOnly(note, noteContext);
  const readonlyRef = useRef(readonly);
  readonlyRef.current = readonly || !ownsEdit;

  function commitEdit() {
    if (composing.current) throw new Error('Finish text composition before leaving the map.');
    // The documented native blur path commits the textarea without changing selection.
    const textarea = host.current?.querySelector('textarea');
    if (textarea) textarea.blur();
  }

  // Register before the saving hook so a keyboard-triggered note switch commits
  // an active textarea before Trilium snapshots the pending document.
  useTriliumEvent('beforeNoteSwitch', async ({ noteContext: target }) => {
    if (target.ntxId === noteContext?.ntxId) { commitEdit(); await save.updateNowIfNecessary(); }
  });
  useTriliumEvent('beforeNoteContextRemove', async ({ ntxIds }) => {
    if (ntxIds.includes(noteContext?.ntxId)) { commitEdit(); await save.updateNowIfNecessary(); }
  });

  const save = useEditorSpacedUpdate({
    note, noteType: 'render', noteContext, updateInterval: 400,
    getData: () => {
      if (conflict.current) throw new Error('Willow save paused: external change detected.');
      return committed.current === undefined || readonlyRef.current ? undefined : { content: committed.current };
    },
    onContentChange: content => {
      if (disposed.current || content === committed.current || content === acknowledged.current) return;
      if (committed.current !== acknowledged.current || host.current?.querySelector('textarea')) {
        conflict.current = true;
        setError('External change detected. This spike does not merge concurrent edits.');
        return;
      }
      pendingContent.current = content;
      install(content);
    },
    dataSaved: ({ content }) => {
      acknowledged.current = content;
      if (!disposed.current) setStatus(committed.current === content ? 'Saved' : 'Unsaved');
    },
  });

  function destroy() {
    if (!editor.current) return;
    editor.current.destroy();
    editor.current = null;
    diagnostics.destroyed++;
    diagnostics.active.delete(instanceId.current);
  }

  function install(content: string) {
    if (!host.current || disposed.current) return;
    try {
      const document = parseDocument(content);
      applying.current = true;
      if (editor.current) {
        // setDocument reports validation errors through events rather than throwing.
        let replacementError: string | undefined;
        const unsubscribe = editor.current.on('error', ({ message }) => { replacementError = message; });
        try { editor.current.setDocument(document); } finally { unsubscribe(); }
        if (replacementError) throw new Error(replacementError);
      }
      else {
        editor.current = new MindMapEditor(host.current, { document, readonly: readonlyRef.current });
        diagnostics.mounted++;
        diagnostics.active.set(instanceId.current, { noteId: note.noteId, host: host.current, editor: editor.current,
          flush: async () => { commitEdit(); await save.updateNowIfNecessary(); },
          grant: writable => { readonlyRef.current = readonly || !writable; setOwnsEdit(writable); },
        });
        editor.current.on('documentchange', ({ document, reason }) => {
          if (applying.current || reason === 'replacement') return;
          committed.current = serializeDocument(document);
          setStatus('Unsaved');
          save.scheduleUpdate();
        });
        editor.current.on('error', ({ message }) => setError(message));
      }
      committed.current = acknowledged.current = content;
      setStatus(readonlyRef.current ? 'Read-only' : 'Saved');
      setError('');
    } catch (e) {
      // A failed load must not leave the previous map editable over invalid source.
      destroy();
      committed.current = acknowledged.current = undefined;
      setError(String(e));
      setStatus('Cannot load');
    }
    finally { applying.current = false; }
  }

  useLayoutEffect(() => {
    disposed.current = false;
    if (!diagnostics.writers.has(note.noteId)) {
      diagnostics.writers.set(note.noteId, instanceId.current);
      readonlyRef.current = readonly;
      setOwnsEdit(true);
    }
    if (pendingContent.current !== undefined) install(pendingContent.current);
    const section = host.current!.parentElement!;
    const container = section.closest('.scrolling-container');
    const size = () => {
      if (container && container.clientHeight > 0) section.style.setProperty('--willow-pane-height', `${Math.max(160, container.clientHeight - 8)}px`);
    };
    const resize = new ResizeObserver(size);
    if (container) resize.observe(container);
    size();
    return () => {
      resize.disconnect();
      try {
        commitEdit();
        void save.updateNowIfNecessary().catch(e => console.error('Willow save failed', e));
      } finally {
        disposed.current = true;
        destroy();
        if (diagnostics.writers.get(note.noteId) === instanceId.current) diagnostics.writers.delete(note.noteId);
      }
    };
  }, []);

  useEffect(() => {
    if (!editor.current || acknowledged.current === undefined) return;
    commitEdit();
    destroy();
    // Rebuilding for a mode change must not acknowledge an unsaved document.
    const base = acknowledged.current;
    install(committed.current ?? base);
    acknowledged.current = base;
  }, [readonly, ownsEdit]);

  async function takeEditing() {
    const previous = diagnostics.active.get(diagnostics.writers.get(note.noteId) ?? '');
    try {
      await previous?.flush();
      previous?.grant(false);
      diagnostics.writers.set(note.noteId, instanceId.current);
      readonlyRef.current = readonly;
      setOwnsEdit(true);
    } catch (e) { setError(`Cannot transfer editing: ${String(e)}`); }
  }

  // Trilium searches descendants for data-ntx-id when moving splits. Never reuse
  // that host-owned attribute: it would move a split into the map's own DOM.
  return h('section', { class: 'willow-spike', 'data-note-id': note.noteId, 'data-willow-context': noteContext?.ntxId },
    h('style', null, styles),
    h('div', { class: 'willow-spike-bar' },
      h('button', { onClick: () => editor.current?.fit() }, 'Fit map'),
      h('button', { onClick: async () => {
        try { commitEdit(); await save.updateNowIfNecessary(); }
        catch (e) { setError(String(e)); }
      } }, 'Save'),
      !ownsEdit && !readonly && h('button', { onClick: takeEditing }, 'Edit in this pane'),
      h('span', { role: 'status' }, status)),
    error && h('div', { class: 'willow-spike-error', role: 'alert' }, error),
    h('div', { ref: host, class: 'willow-spike-host',
      onCompositionStart: () => { composing.current = true; },
      onCompositionEnd: () => { composing.current = false; } }));
}
