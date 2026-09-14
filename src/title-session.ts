import { initializeTemplate, parseDocument, serializeDocument } from './document';
import { SaveSession } from './save-session';

/** Title coordination follows the document session across refreshes and splits. */
export class TitleSession extends SaveSession {
  private title: string;
  private target?: string;
  private sending?: string;
  private validated = false;
  private aligned = false;
  private titleEditing = false;
  private titlePending = false;
  private titleDraft?: string;
  private titleConflict = false;

  editTitle(editing: boolean, value?: string) {
    this.titleEditing = editing;
    if (editing) this.cancelTimer();
    if (!editing) {
      if (value !== undefined && value !== this.title) { this.title = value; this.titlePending = true; }
      if (this.titlePending) { this.titlePending = false; this.applyTitle(); }
      if (this.dirty && this.local !== undefined) super.change(this.local);
    }
  }

  constructor(private noteId: string, title: string, read: () => Promise<string>, write: (content: string) => Promise<void>,
    private readTitle: () => Promise<string>, private writeTitle: (title: string) => Promise<void>) {
    super(read, write, content => this.finishTitle(content));
    this.title = title;
  }

  override get dirty() { return super.dirty || this.target !== undefined; }

  private root(content?: string) {
    if (content === undefined) return undefined;
    try {
      const text = parseDocument(initializeTemplate(content, this.noteId)).root.text;
      return typeof text === 'string' ? text : undefined;
    } catch { return undefined; }
  }

  /** Called only after the widget has validated the complete document. */
  validate() { this.validated = true; this.align(); }
  invalidate() { this.validated = false; }

  align() {
    if (this.aligned || !this.validated || !this.writable || this.local === undefined
      || this.editing || this.recovering || this.incoming !== undefined) return;
    this.aligned = true;
    this.applyTitle();
  }

  private applyTitle() {
    if (this.titleEditing) { this.titlePending = true; return; }
    if (!this.validated || !this.writable || this.local === undefined) { this.aligned = false; return; }
    if (this.root(this.local) === undefined || this.root(this.local) === this.title) return;
    const content = this.withTitle(this.base ?? this.local);
    if ((this.dirty && this.local !== this.titleDraft) || this.editing || this.recovering) {
      // Preserve both the unfinished draft and the external title change.
      this.titleConflict = true;
      this.conflict(content);
    } else {
      this.target = undefined;
      this.titleDraft = this.withTitle(this.local);
      super.change(this.titleDraft);
    }
  }

  private withTitle(content: string) {
    const document = parseDocument(initializeTemplate(content, this.noteId));
    return serializeDocument({ ...document, root: { ...document.root, text: this.title } });
  }

  receiveTitle(title: string) {
    if (title === this.title) return;
    this.title = title;
    if (title === this.sending) return; // Own acknowledgement, possibly with a newer root draft.
    if (title === this.target) this.target = undefined;
    this.applyTitle();
  }

  override change(content: string) {
    this.titleDraft = undefined;
    const root = this.root(content);
    if (root !== undefined && root !== this.root(this.local)) this.target = root === this.title ? undefined : root;
    super.change(content);
  }

  override receive(content: string) {
    const previous = this.local;
    super.receive(content);
    if (previous !== undefined && this.validated && this.aligned && this.local !== previous && this.local === content && this.incoming === undefined) {
      const root = this.root(content);
      if (root !== undefined && root !== this.title) {
        this.target = root;
        super.change(content); // A remote root edit also needs its title saved.
      }
    }
  }

  private async finishTitle(content: string) {
    if (this.local !== content || this.target === undefined) return;
    const target = this.target;
    const remote = await this.readTitle();
    if (remote !== this.title && remote !== target) {
      this.receiveTitle(remote);
      throw new Error('The note title changed while saving. Resolve the external change before saving.');
    }
    if (this.local !== content || this.target !== target) return;
    if (!this.writable || this.incoming !== undefined) throw new Error('The note became read-only or changed while saving.');
    this.sending = target;
    try {
      if (remote !== target) await this.writeTitle(target);
      this.title = target;
      if (this.target === target) this.target = undefined;
    } finally { this.sending = undefined; }
  }

  override async useIncoming(prepare?: (content: string) => Promise<void>, authorize?: () => Promise<boolean>) {
    let accepted = !authorize;
    await super.useIncoming(prepare, authorize ? async () => (accepted = await authorize()) : undefined);
    if (accepted && this.incoming === undefined) {
      this.target = undefined;
      if (this.titleConflict) {
        this.titleConflict = false;
        this.aligned = false;
        this.align();
      } else if (this.validated) {
        const root = this.root(this.local);
        if (root !== undefined && root !== this.title) {
          this.target = root;
          super.change(this.local!);
        }
      }
    }
  }
}
