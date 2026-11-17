export interface Note {
  id: string;
  title: string;
  body: string;
  path: string;
  revision: string;
}
export interface Workspace {
  root: string;
  name: string;
  notes: Note[];
}
export interface NoteAPI {
  open(): Promise<Workspace | null>;
  load(): Promise<Workspace | null>;
  refresh(): Promise<Workspace>;
  create(title: string, body?: string): Promise<Note>;
  save(data: Pick<Note, "id" | "body" | "revision">): Promise<Note>;
  trash(data: Pick<Note, "id" | "revision">): Promise<void>;
  search(query: string): Promise<Note[]>;
  export(data: { id: string; format: "md" | "html" | "pdf" }): Promise<boolean>;
  importMarkdown(): Promise<Note[]>;
  onClose?(callback: () => void): () => void;
  confirmClose?(): void;
}
declare global {
  interface Window {
    xdocs?: NoteAPI;
  }
}
