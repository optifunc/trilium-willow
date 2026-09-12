import { describe, it, expect } from 'vitest';
import { parseDocument, serializeDocument, initializeTemplate, finishInitialTitle, TEMPLATE_CONTENT } from '../src/document';

describe('Willow document envelope', () => {
  it('round trips IDs, order, sides, Unicode, multiline text and state', () => {
    const document = { root: { id: 'r', text: 'Plán\n第二行', children: [
      { id: 'b', text: '', side: 'left' as const, checked: false, collapsed: true, children: [] },
      { id: 'a', text: 'right', side: 'right' as const, children: [] },
    ] } };
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });
  it.each(['', '{', '{}', 'null', '{"format":"mind-elixir","version":1,"document":{}}',
    '{"format":"trilium-willow-mindmap","version":2,"document":{"root":{}}}'])('rejects unsupported input %s', input => {
    expect(() => parseDocument(input)).toThrow();
  });
});

describe('native template initialization', () => {
  it('gives each instance its own root ID and follows the first native title edit', () => {
    const a = initializeTemplate(TEMPLATE_CONTENT, 'note-a', 'New note');
    const b = initializeTemplate(TEMPLATE_CONTENT, 'note-b', 'New note');
    expect(parseDocument(a).root.id).not.toBe(parseDocument(b).root.id);
    const named = finishInitialTitle(a, 'Project');
    expect(parseDocument(named).root.text).toBe('Project');
    expect(finishInitialTitle(named, 'Later note title')).toBe(named);
  });
  it('stops following the title as soon as the map is edited', () => {
    const seeded = initializeTemplate(TEMPLATE_CONTENT, 'note', 'New note');
    const document = parseDocument(seeded); document.root.text = 'My root';
    const edited = serializeDocument(document);
    expect(finishInitialTitle(edited, 'Later note title')).toBe(edited);
  });
  it('never initializes empty or malformed source', () => {
    expect(() => initializeTemplate('', 'note', 'Title')).toThrow();
    expect(() => initializeTemplate(TEMPLATE_CONTENT.replace('Mind map', 'Changed seed'), 'note', 'Title')).toThrow();
    const original = serializeDocument({ root: { id: 'mine', text: 'Existing', children: [] } });
    expect(initializeTemplate(original, 'note', 'Title')).toBe(original);
  });
});
