// Trilium v0.105 transport. baseApiUrl also handles the desktop's custom scheme.
declare const glob: { baseApiUrl: string; getHeaders(): Promise<Record<string, string>> };
export async function hostRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${glob.baseApiUrl}${path}`, {
    method, cache: 'no-store', headers: { ...await glob.getHeaders(), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new HostError(response.status);
  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}
export async function readContent(noteId: string) {
  return (await hostRequest<{ content: string }>('GET', `notes/${noteId}/blob`)).content;
}
export async function writeContent(noteId: string, content: string) {
  await hostRequest('PUT', `notes/${noteId}/data`, { content });
}

interface NoteMetadata { noteId: string; isDeleted: boolean; isProtected: boolean; }
interface Attribute { type: string; name: string; value: string; }
export interface CreateRequest { sourceId: string; parentId: string; noteId: string; title: string; content: string; }
class HostError extends Error {
  constructor(public status: number) { super(`Trilium request failed (${status}). Retry when the connection is available.`); }
}

export async function createMap(request: CreateRequest): Promise<string> {
  const [source, parent, attributes] = await Promise.all([
    hostRequest<NoteMetadata>('GET', `notes/${request.sourceId}`),
    hostRequest<NoteMetadata>('GET', `notes/${request.parentId}`),
    hostRequest<Attribute[]>('GET', `notes/${request.sourceId}/attributes`),
  ]);
  if (source.isDeleted || parent.isDeleted) throw new Error('The source or destination is unavailable.');
  const bundle = attributes.find(a => a.type === 'relation' && a.name === 'renderNote')?.value;
  if (!bundle) throw new Error('The shared Willow editor is missing.');
  await hostRequest('GET', `notes/${bundle}`);
  let existing: NoteMetadata | undefined;
  try { existing = await hostRequest<NoteMetadata>('GET', `notes/${request.noteId}`); }
  catch (e) { if (!(e instanceof HostError) || e.status !== 404) throw e; }
  if (existing) {
    // Retry after a lost response: recognize the complete copy without overwriting it.
    const attrs = await hostRequest<Attribute[]>('GET', `notes/${request.noteId}/attributes`);
    if (existing.isDeleted || await readContent(request.noteId) !== request.content
      || !attrs.some(a => a.type === 'relation' && a.name === 'renderNote' && a.value === bundle))
      throw new Error('The previously created copy has changed. Open it before retrying.');
    return existing.noteId;
  }
  // The stock create route inserts content, branch and attributes in one transaction.
  const result = await hostRequest<{ note: NoteMetadata }>('POST', `notes/${request.parentId}/children?target=into`, {
    noteId: request.noteId, title: request.title, content: request.content,
    type: 'render', mime: 'application/json', isProtected: source.isProtected || parent.isProtected,
    attributes: [
      { type: 'relation', name: 'renderNote', value: bundle },
      { type: 'label', name: 'willowMindMap', value: '' },
      { type: 'label', name: 'iconClass', value: 'bx bx-git-branch' },
    ],
  });
  return result.note.noteId;
}
export function newNoteId() { return crypto.randomUUID().replaceAll('-', '').slice(0, 12); }
