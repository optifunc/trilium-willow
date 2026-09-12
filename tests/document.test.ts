import { describe, it, expect } from 'vitest';
import { parseDocument, serializeDocument, initializeTemplate, TEMPLATE_CONTENT } from '../src/document';

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
  it('gives each instance its own root ID and an independent default label', () => {
    const a = initializeTemplate(TEMPLATE_CONTENT, 'note-a');
    const b = initializeTemplate(TEMPLATE_CONTENT, 'note-b');
    expect(parseDocument(a).root.id).not.toBe(parseDocument(b).root.id);
    expect(parseDocument(a).root.text).toBe('Mind map');
    expect(initializeTemplate(a, 'note-a')).toBe(a);
  });
  it('preserves labels in documents carrying the former title-following marker', () => {
    const content = JSON.stringify({format:'trilium-willow-mindmap',version:1,titleFromNote:true,
      document:{root:{id:'existing',text:'My root',children:[]}}});
    expect(initializeTemplate(content, 'note')).toBe(content);
  });
  it('never initializes empty or malformed source', () => {
    expect(() => initializeTemplate('', 'note')).toThrow();
    expect(() => initializeTemplate(TEMPLATE_CONTENT.replace('Mind map', 'Changed seed'), 'note')).toThrow();
    const original = serializeDocument({ root: { id: 'mine', text: 'Existing', children: [] } });
    expect(initializeTemplate(original, 'note')).toBe(original);
  });
});
