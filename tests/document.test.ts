import { describe, it, expect } from 'vitest';
import { parseDocument, serializeDocument } from '../src/document';

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
