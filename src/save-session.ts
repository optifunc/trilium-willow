import type { CreateRequest } from './host';

export type SaveState = 'loading' | 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

/** One document's in-memory draft and serialized saves, independent of pane lifetime. */
export class SaveSession {
  base?: string;
  local?: string;
  incoming?: string;
  state: SaveState = 'loading';
  error = '';
  private _editing = false;
  private generation = 0;
  private remoteGeneration = 0;
  private _recovering = false;
  recoveryRequest?: CreateRequest;
  recovered?: string;
  writable = false;
  private sent?: string;
  private pending?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private listeners = new Set<() => void>();

  constructor(private read: () => Promise<string>, private write: (content: string) => Promise<void>,
    private finishWrite: (content: string) => Promise<void> = async () => {}) {}

  get dirty() { return this.local !== undefined && this.local !== this.base; }
  get saving() { return this.pending !== undefined; }
  get recovering() { return this._recovering; }
  get editing() { return this._editing; }
  set editing(value: boolean) {
    if (value && !this._editing) this.generation++;
    this._editing = value;
  }
  subscribe(callback: () => void) { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
  notify() { for (const callback of this.listeners) callback(); }

  protected conflict(content: string) {
    this.remoteGeneration++;
    this.incoming = content;
    this.state = 'conflict';
    this.cancelTimer();
    this.notify();
  }

  receive(content: string) {
    // In-flight echoes must not acknowledge a newer local draft or reset its editor.
    if (content === this.base || content === this.sent || content === this.local || content === this.incoming) return;
    this.remoteGeneration++;
    if (this.dirty || this.editing || this.incoming !== undefined || this.recovering) {
      this.incoming = content;
      this.state = 'conflict';
      this.cancelTimer();
    } else {
      this.base = this.local = content;
      this.state = 'saved';
      this.error = '';
    }
    this.notify();
  }

  change(content: string) {
    this.generation++;
    this.local = content;
    if (this.incoming !== undefined) this.state = 'conflict';
    else if (!this.writable && this.dirty) {
      // The host may make a note read-only while its textarea still has focus.
      // Committing that textarea must retain a retryable draft, not a stranded
      // "unsaved" state with no timer or recovery action after unlocking.
      this.cancelTimer();
      this.state = 'error';
      this.error = 'Editing became read-only. Your draft is retained in this session.';
    }
    else {
      this.state = this.saving ? 'saving' : this.dirty ? 'unsaved' : 'saved';
      this.error = '';
      this.cancelTimer();
      if (this.dirty && this.writable && !this.recovering) this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 400);
    }
    this.notify();
  }

  cancelTimer() { clearTimeout(this.timer); this.timer = undefined; }

  flush(): Promise<void> {
    this.cancelTimer();
    if (this.recovering) return Promise.reject(new Error('Wait for map recovery to finish.'));
    if (this.pending) return this.pending;
    this.pending = this.drain().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async drain() {
    try {
      if (this.incoming !== undefined) throw new Error('Resolve the external change before saving.');
      while (this.dirty) {
        if (this.incoming !== undefined) throw new Error('Resolve the external change before saving.');
        if (!this.writable) throw new Error('Editing is read-only. Your draft is retained in this session.');
        this.state = 'saving'; this.notify();
        const content = this.local!;
        const remote = await this.read();
        // This preflight catches detected changes; it is not an atomic server lock.
        if (remote !== this.base && remote !== content) this.receive(remote);
        if (this.incoming !== undefined) throw new Error('Resolve the external change before saving.');
        if (!this.writable) throw new Error('Editing became read-only. Your draft is retained in this session.');
        if (remote !== content) {
          this.sent = content;
          await this.write(content);
        }
        await this.finishWrite(content);
        this.base = content;
        this.sent = undefined;
        // A notification received during the request cannot be cleared by its acknowledgement.
        if (this.incoming !== undefined) throw new Error('Resolve the external change before saving.');
      }
      this.state = this.base === undefined ? 'loading' : 'saved';
      this.error = '';
    } catch (error) {
      this.sent = undefined;
      this.error = String(error);
      this.state = this.incoming !== undefined ? 'conflict' : 'error';
      throw error;
    } finally { this.notify(); }
  }

  async settle() { this.cancelTimer(); await this.pending?.catch(() => {}); }

  /** Coordinates confirmation/copy/read across every pane, including replacements. */
  async useIncoming(prepare?: (content: string) => Promise<void>, authorize?: () => Promise<boolean>) {
    if (this.recovering) throw new Error('Wait for map recovery to finish.');
    this._recovering = true;
    const generation = this.generation, remoteGeneration = this.remoteGeneration;
    const validate = () => {
      if (generation !== this.generation || this.editing || remoteGeneration !== this.remoteGeneration)
        throw new Error('The map changed during recovery. Your newer draft is retained; resolve again.');
    };
    this.notify();
    try {
      if (authorize && !await authorize()) return;
      await this.settle(); validate();
      if (prepare) { await prepare(this.local!); validate(); }
      const content = await this.read();
      validate();
      this.base = this.local = content;
      this.incoming = undefined;
      this.error = '';
      this.state = 'saved';
      this.recoveryRequest = undefined;
    } catch (error) {
      this.cancelTimer();
      this.error = String(error);
      this.state = this.incoming !== undefined ? 'conflict' : 'error';
      throw error;
    } finally {
      this._recovering = false;
      this.notify();
    }
  }
}
