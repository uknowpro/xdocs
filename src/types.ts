export interface Note {
  id: string;
  title: string;
  body: string;
  path: string;
  revision: string;
}
export interface Workspace {
  kind?: "local" | "server";
  role?: "owner" | "editor" | "reader";
  pending?: number;
  root: string;
  name: string;
  notes: Note[];
}
export interface HistoryEntry {
  title: string;
  body: string;
  path: string;
  savedAt: string;
  revision: string;
}
export interface TrashEntry extends Note {
  token: string;
  deletedAt: string;
}
export interface Attachment {
  path: string;
  name: string;
  kind: "pdf" | "image";
}
export interface OrganizationInfo {
  id: string;
  name: string;
  role: "owner" | "editor" | "reader";
}
export interface OrganizationConflict {
  id: string;
  title: string;
  body: string;
  server: { body?: string };
}
export interface UpdateState {
  status: string;
  version: string;
  message: string;
}
export interface CollaborationPacket {
  participants?: { id: string; label: string }[];
  id: string;
  generation: string;
  state: string;
  pending?: boolean;
  error?: string;
}
export interface NoteAPI {
  collaborationStart?(id: string): Promise<CollaborationPacket>;
  collaborationUpdate?(
    packet: CollaborationPacket,
  ): Promise<{ saved: boolean }>;
  collaborationSync?(id: string): Promise<CollaborationPacket>;
  collaborationCopy?(id: string): Promise<Note>;
  updateStatus?(): Promise<UpdateState>;
  checkUpdate?(): Promise<UpdateState>;
  downloadUpdate?(): Promise<UpdateState>;
  installUpdate?(): Promise<void>;
  onUpdate?(callback: (state: UpdateState) => void): () => void;
  organizationLogin?(server: string): Promise<OrganizationInfo[]>;
  organizationOpen?(id: string): Promise<Workspace>;
  organizationConflicts?(): Promise<OrganizationConflict[]>;
  organizationResolve?(
    id: string,
    choice: "server" | "copy",
  ): Promise<Workspace>;
  organizationLogout?(): Promise<Workspace | null>;
  history?(id: string): Promise<HistoryEntry[]>;
  restoreHistory?(data: {
    id: string;
    revision: string;
    historyRevision: string;
  }): Promise<Note>;
  listTrash?(): Promise<TrashEntry[]>;
  restoreTrash?(token: string): Promise<Note>;
  addAttachment?(): Promise<Attachment | null>;
  readAttachment?(relative: string): Promise<{ mime: string; data: string }>;
  onChanged?(callback: (workspace: Workspace) => void): () => void;
  onWatchError?(callback: (message: string) => void): () => void;
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
