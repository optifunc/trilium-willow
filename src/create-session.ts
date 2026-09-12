import { serializeDocument } from './document';
import { newNoteId, type CreateRequest } from './host';

/** Keeps title, in-flight creation and retry identity through host remounts. */
export class CreationSession {
  title = 'New mind map';
  busy = false;
  error = '';
  created?: string;
  request?: CreateRequest;
  private listeners = new Set<() => void>();
  constructor(private create: (request: CreateRequest) => Promise<string>) {}
  subscribe(callback: () => void) { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
  private notify() { for (const callback of this.listeners) callback(); }
  async submit(sourceId: string, parentId: string, title: string) {
    if (this.busy || !title.trim()) return;
    this.request ??= { sourceId, parentId, noteId: newNoteId(), title: title.trim(),
      content: serializeDocument({ root: { id: newNoteId(), text: title.trim(), children: [] } }) };
    this.busy = true; this.error = ''; this.notify();
    try {
      this.created = await this.create(this.request);
      this.request = undefined;
    } catch (e) { this.error = `Could not create the map. Retry keeps the same creation request. ${String(e)}`; }
    finally { this.busy = false; this.notify(); }
  }
}
