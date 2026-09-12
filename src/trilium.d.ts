// Narrow, version-specific contract used by the v0.105.0 adapter. These imports are
// supplied by Trilium, never bundled from a second Preact installation.
declare module 'trilium:preact' {
  export interface Note { noteId: string; title: string; type: string; getContent(): Promise<string>; hasLabel(name: string): boolean; hasOwnedLabel(name: string): boolean; getRelationValue(name: string): string | null; getParentNoteIds(): string[]; }
  export interface NoteContext { ntxId: string; note?: Note; notePath?: string; isActive(): boolean; setContextData(key: string, value: unknown): void; }
  export interface ParentComponent {
    componentId: string;
    registerHandler(event: string, handler: (data: any) => unknown): void;
    removeHandler(event: string, handler: (data: any) => unknown): void;
  }
  export function h(type: string | Function, props: Record<string, unknown> | null, ...children: unknown[]): any;
  export function useRef<T>(initial: T): { current: T };
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((old: T) => T)) => void];
  export function useState<T>(): [T | undefined, (value: T | undefined) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useNoteContext(): { note?: Note; noteContext?: NoteContext; parentComponent: ParentComponent; ntxId?: string };
  export function useEffectiveReadOnly(note: Note, context?: NoteContext): boolean;
  export function useNoteBlob(note: Note): { content: string } | null | undefined;
  export function useTriliumEvent(event: string, handler: (data: any) => unknown): void;
}
declare module 'trilium:api' {
  export const originEntity: import('trilium:preact').Note;
  export function showConfirmDialog(message: string): Promise<boolean>;
}
