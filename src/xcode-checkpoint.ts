import type { Harness, InputFile, Turn } from "./xcode-session";

export type Checkpoint = {
  sourceHistory?:Turn["sourceHistory"];
  id: string;
  endpoint: string;
  model: string;
  harness: Harness;
  messages: unknown[];
  prompt: string;
  files: InputFile[];
  answers: Turn["answers"];
  partial: string;
};
let database: Promise<IDBDatabase> | undefined;
function open() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("xdocs-session-recovery", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("runs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("runs", mode),
      request = action(tx.objectStore("runs"));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () =>
      reject(tx.error ?? Error("체크포인트를 저장할 수 없습니다."));
  });
}
export async function loadCheckpoint(
  key: string,
): Promise<Checkpoint | undefined> {
  const [base, progress] = await Promise.all(
    [key, key + "/progress"].map((k) => transact("readonly", (s) => s.get(k))),
  );
  return base && progress?.id === base.id ? { ...base, ...progress } : base;
}
export const saveCheckpoint = (key: string, data: Checkpoint) =>
  transact("readwrite", (s) => s.put(data, key));
export const saveProgress = (
  key: string,
  data: Pick<Checkpoint, "id" | "answers" | "partial">,
) => transact("readwrite", (s) => s.put(data, key + "/progress"));
export const clearCheckpoint = (key: string) =>
  transact("readwrite", (s) => {
    s.delete(key + "/progress");
    return s.delete(key);
  });

export type QueuedPrompt = {
  harness?:Harness;
  useCurrentHarness?:boolean;
  id: string;
  prompt: string;
  files: InputFile[];
  templates: (File | undefined)[];
  omitted: string[];
  endpoint: string;
  model: string;
};

// Separate keys keep waiting prompts independent of an interrupted stage.
export const readWaiting = (key:string) =>
  transact<QueuedPrompt[] | undefined>("readonly",store=>store.get(key+"/waiting"));
export const writeWaiting = (key:string, items:QueuedPrompt[]) =>
  items.length ? transact("readwrite",store=>{
    store.put(items.length,key+"/count");
    return store.put(items,key+"/waiting");
  }) : transact("readwrite",store=>{
    store.delete(key+"/count");
    return store.delete(key+"/waiting");
  });

export async function readQueueCounts(scope:string) {
  const prefix=JSON.stringify([scope]).slice(0,-1)+",";
  const keys=await transact("readonly",store=>store.getAllKeys(IDBKeyRange.bound(prefix,prefix+"\uffff")));
  const counts=new Map<string,number>();
  for (const entry of keys) {
    if (typeof entry!=="string" || !entry.endsWith("/waiting")) continue;
    const key=entry.slice(0,-"/waiting".length);
    const [,page]=JSON.parse(key);
    // Existing queues from before count metadata was introduced are read once.
    const count=await transact<number | undefined>("readonly",store=>store.get(key+"/count"));
    counts.set(page,count ?? (await readWaiting(key))?.length ?? 0);
  }
  return counts;
}

export const readComposerDraft = (key:string) =>
  transact<string | undefined>("readonly",store=>store.get(key+"/draft"));
export const writeComposerDraft = (key:string, prompt:string) =>
  transact("readwrite",store=>store.put(prompt,key+"/draft"));

const draftKeys = new WeakMap<InputFile, string>();
export function fileKey(file: InputFile) {
  let key = draftKeys.get(file);
  if (!key) {
    key = crypto.randomUUID();
    draftKeys.set(file, key);
  }
  return key;
}

type DraftInputs = {
  files: InputFile[]; keys:string[]; templates:(File | undefined)[];
  omitted:string[]; form?: File;
};
export const restoreFileKey=(file:InputFile,key:string)=>draftKeys.set(file,key);
export const readDraftInputs=(key:string)=>transact<DraftInputs|undefined>("readonly",s=>s.get(key+"/inputs"));
export const writeDraftInputs=(key:string,data:DraftInputs)=>data.files.length || data.form || data.omitted.length
  ? transact("readwrite",s=>s.put(data,key+"/inputs")) : transact("readwrite",s=>s.delete(key+"/inputs"));

export type NoteApplication = {
  id:string; turn:number; title:string; page:string; date:string;
  before:string; after:string; state:"pending"|"applied"|"undone";
};
const applicationPrefix=(session:string)=>session+"/note-application/";
export const saveNoteApplication=(session:string,record:NoteApplication)=>
  transact("readwrite",store=>store.put(record,applicationPrefix(session)+record.id));
export const removeNoteApplication=(session:string,id:string)=>
  transact("readwrite",store=>store.delete(applicationPrefix(session)+id));
export const readNoteApplications=(session:string)=>{
  const prefix=applicationPrefix(session);
  return transact<NoteApplication[]>("readonly",store=>store.getAll(IDBKeyRange.bound(prefix,prefix+"\uffff")));
};
