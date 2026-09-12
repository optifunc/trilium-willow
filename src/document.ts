import type { MindMapDocument } from '@mindmap/widget';

export const FORMAT = 'trilium-willow-mindmap';
export const TEMPLATE_CONTENT = JSON.stringify({ format: FORMAT, version: 1, initializeFromTitle: true,
  document: { root: { id: 'willow-template-root', text: 'Mind map', children: [] } } });

/** Only the explicit, intact template seed may initialize a new document. */
export function initializeTemplate(content: string, noteId: string): string {
  const value = JSON.parse(content);
  if (value?.format !== FORMAT || value.version !== 1 || value.initializeFromTitle !== true) return content;
  const root = value.document?.root;
  if (root?.id !== 'willow-template-root' || root.text !== 'Mind map' || !Array.isArray(root.children)
    || root.children.length || Object.keys(root).length !== 3) throw new Error('Invalid Willow template seed. Original content has not been changed.');
  return serializeDocument({ root: { id: `root-${noteId}`, text: 'Mind map', children: [] } });
}

/** Validate the envelope here; the widget validates every node before mounting. */
export function parseDocument(content: string): MindMapDocument {
  const value: unknown = JSON.parse(content);
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== FORMAT
    || !('version' in value) || value.version !== 1 || !('document' in value)
    || !value.document || typeof value.document !== 'object' || !('root' in value.document)) {
    throw new Error('Unsupported Willow document. Original note content has not been changed.');
  }
  return value.document as MindMapDocument;
}

export function serializeDocument(document: MindMapDocument): string {
  return JSON.stringify({ format: FORMAT, version: 1, document });
}
