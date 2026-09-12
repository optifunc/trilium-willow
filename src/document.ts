import type { MindMapDocument } from '@mindmap/widget';

export const FORMAT = 'trilium-willow-mindmap';

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
