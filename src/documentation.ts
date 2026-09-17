import type { Note } from 'trilium:preact';
import { getNote, openTabWithNote } from 'trilium:api';

/** Resolve only the installation referenced by this map; imported IDs are remapped. */
export async function openDocumentation(note: Note): Promise<void> {
  const editorId = note.getRelationValue('renderNote');
  const editor = editorId ? await getNote(editorId) : null;
  const parents = editor ? await Promise.all(editor.getParentNoteIds().map(id => getNote(id))) : [];
  const guides = parents.filter((parent): parent is Note => !!parent && parent.type === 'text' && parent.hasOwnedLabel('willowAddon'));
  if (guides.length !== 1) throw new Error('Documentation is unavailable for this installation.');
  await openTabWithNote(guides[0]!.noteId, true);
}
