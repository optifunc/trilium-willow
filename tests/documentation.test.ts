import { expect, it, vi } from 'vitest';
import type { Note } from 'trilium:preact';
const api = vi.hoisted(() => ({ getNote: vi.fn(), openTabWithNote: vi.fn() }));
vi.mock('trilium:api', () => api);
import { openDocumentation } from '../src/documentation';
const note = (id: string, extra: Partial<Note> = {}): Note => ({ noteId: id, title: 'Renamed guide', type: 'text',
  getContent: async () => '', hasLabel: () => false, hasOwnedLabel: () => false,
  getRelationValue: () => null, getParentNoteIds: () => [], ...extra });
it('follows this map’s shared editor to its labeled guide across renamed installations', async () => {
  const notes = new Map([
    ['editor-a', note('editor-a', {getParentNoteIds: () => ['guide-a']})],
    ['editor-b', note('editor-b', {getParentNoteIds: () => ['guide-b']})],
    ['guide-a', note('guide-a', {hasOwnedLabel: key => key === 'willowAddon'})],
    ['guide-b', note('guide-b', {hasOwnedLabel: key => key === 'willowAddon'})],
  ]);
  api.getNote.mockImplementation(id => notes.get(id)); api.openTabWithNote.mockClear();
  for (const installation of ['a', 'b']) await openDocumentation(note('map', {getRelationValue: () => `editor-${installation}`}));
  expect(api.openTabWithNote.mock.calls).toEqual([['guide-a', true], ['guide-b', true]]);
});
it.each([0, 2])('refuses missing or ambiguous guides (%i) without navigation', async count => {
  api.openTabWithNote.mockClear();
  api.getNote.mockImplementation(id => id === 'editor' ? note(id, {getParentNoteIds: () => Array.from({length: count}, (_,i) => `guide-${i}`)})
    : note(id, {hasOwnedLabel: () => true}));
  await expect(openDocumentation(note('map', {getRelationValue: () => 'editor'}))).rejects.toThrow('Documentation is unavailable');
  expect(api.openTabWithNote).not.toHaveBeenCalled();
});
