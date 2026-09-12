// Narrow, version-specific contract used by the v0.105.0 spike. These imports are
// supplied by Trilium, never bundled from a second Preact installation.
declare module 'trilium:preact' {
  export interface Note { noteId: string; title: string; type: string; getContent(): Promise<string>; }
  export interface NoteContext { ntxId: string; note?: Note; isActive(): boolean; }
  export interface ParentComponent {
    componentId: string;
    registerHandler(event: string, handler: (data: any) => unknown): void;
    removeHandler(event: string, handler: (data: any) => unknown): void;
  }
  export function h(type: string | Function, props: Record<string, unknown> | null, ...children: unknown[]): any;
  export function useRef<T>(initial: T): { current: T };
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((old: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useNoteContext(): { note?: Note; noteContext?: NoteContext; parentComponent: ParentComponent; ntxId?: string };
  export function useEffectiveReadOnly(note: Note, context?: NoteContext): boolean;
  export function useTriliumEvent(event: string, handler: (data: any) => unknown): void;
  export interface SaveQueue { scheduleUpdate(): void; updateNowIfNecessary(): Promise<void>; isAllSavedAndTriggerUpdate(): boolean; }
  export function useEditorSpacedUpdate(options: {
    note: Note; noteType: string; noteContext?: NoteContext;
    getData(): { content: string } | undefined;
    onContentChange(content: string): void;
    dataSaved?(data: { content: string }): void;
    updateInterval?: number;
  }): SaveQueue;
}
