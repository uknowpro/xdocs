import type { Harness, InputFile, Turn } from "./xcode-session";

export type Checkpoint = {
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
  items.length ? transact("readwrite",store=>store.put(items,key+"/waiting"))
    : transact("readwrite",store=>store.delete(key+"/waiting"));

export const readComposerDraft = (key:string) =>
  transact<string | undefined>("readonly",store=>store.get(key+"/draft"));
export const writeComposerDraft = (key:string, prompt:string) =>
  transact("readwrite",store=>store.put(prompt,key+"/draft"));
