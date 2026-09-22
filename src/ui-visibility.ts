import { hostRequest } from './host';

export const uiHiddenLabel = 'willowUiHidden';
interface AttributeRow { noteId: string; type: string; name: string; value: string; isDeleted?: boolean; }
interface Reload { getAttributeRows(): AttributeRow[]; }
interface Subscriber { update(hidden: boolean): void; report(message: string): void; }

/** One confirmed preference, independent of maps, editor history and installations. */
export class UIVisibility {
  private hidden = false;
  private subscribers = new Set<Subscriber>();
  private tail: Promise<void> = Promise.resolve();
  private refreshing?: Promise<void>;
  private revision = 0;
  private reloads = new WeakSet<Reload>();

  constructor(private read: () => Promise<boolean>, private write: (hidden: boolean) => Promise<void>) {}

  subscribe(update: Subscriber['update'], report: Subscriber['report']): () => void {
    const subscriber = { update, report };
    this.subscribers.add(subscriber);
    update(this.hidden);
    // Attribute events are supplied by mounted panes. Refresh after a period
    // with no panes, when changes from another window may have been missed.
    if (this.subscribers.size === 1) this.load();
    return () => { this.subscribers.delete(subscriber); };
  }

  private publish(hidden: boolean) {
    this.hidden = hidden;
    for (const subscriber of this.subscribers) {
      subscriber.update(hidden);
      subscriber.report('');
    }
  }
  private enqueue(work: () => Promise<void>): Promise<void> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => {});
    return result;
  }
  refresh(): Promise<void> {
    this.revision++;
    if (!this.refreshing) {
      const pending = this.enqueue(async () => {
        // A root attribute event during the GET invalidates that snapshot.
        // Reads and writes share a queue so old reads cannot undo a new choice.
        for (;;) {
          const revision = this.revision;
          const hidden = await this.read();
          if (revision === this.revision) { this.publish(hidden); return; }
        }
      });
      this.refreshing = pending;
      const clear = () => { this.refreshing = undefined; };
      void pending.then(clear, clear);
    }
    return this.refreshing;
  }
  private load() {
    void this.refresh().catch(() => {
      for (const subscriber of this.subscribers)
        subscriber.report('Could not load the shared UI visibility preference. Check the connection and reopen the map to retry.');
    });
  }
  reload(event: Reload) {
    // Each mounted pane receives the same native event, including panes from
    // different imported Willow bundles. Process it once for this window.
    if (this.reloads.has(event)) return;
    this.reloads.add(event);
    if (event.getAttributeRows().some(row => row.noteId === 'root' && row.type === 'label' && row.name === uiHiddenLabel)) this.load();
  }
  set(hidden: boolean): Promise<void> {
    return this.enqueue(async () => {
      await this.write(hidden);
      this.publish(hidden);
    });
  }
}

const key = Symbol.for('trilium-willow.ui-visibility');
const shared = globalThis as typeof globalThis & { [key]?: UIVisibility };
export const uiVisibility = shared[key] ??= new UIVisibility(
  async () => (await hostRequest<AttributeRow[]>('GET', 'notes/root/attributes'))
    .some(row => row.noteId === 'root' && row.type === 'label' && row.name === uiHiddenLabel && !row.isDeleted && row.value === 'true'),
  async hidden => { await hostRequest('PUT', 'notes/root/set-attribute', {
    type: 'label', name: uiHiddenLabel, value: String(hidden), isInheritable: false,
  }); },
);
