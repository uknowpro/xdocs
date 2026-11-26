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
  dispatchTracked?: true;
  unconfirmed?: boolean;
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
  const [base, progress, dispatch] = await Promise.all(
    [key, key + "/progress", key + "/dispatch"].map((k) => transact("readonly", (s) => s.get(k))),
  );
  if (!base) return;
  const saved: Checkpoint = progress?.id === base.id ? { ...base, ...progress } : base;
  const unfinished = saved.answers.length < saved.harness.stages.length;
  return {
    ...saved,
    unconfirmed: unfinished && (saved.dispatchTracked
      ? dispatch?.id === saved.id && dispatch.stage >= saved.answers.length
      : true),
  };
}
export const recordDispatch = (key: string, id: string, stage: number) =>
  transact("readwrite", s => s.put({ id, stage }, key + "/dispatch"));
export const clearDispatch = (key: string) =>
  transact("readwrite", s => s.delete(key + "/dispatch"));
export const saveCheckpoint = (key: string, data: Checkpoint) =>
  transact("readwrite", (s) => s.put(data, key));
export const saveProgress = (
  key: string,
  data: Pick<Checkpoint, "id" | "answers" | "partial">,
) => transact("readwrite", (s) => s.put(data, key + "/progress"));
export const clearCheckpoint = (key: string) =>
  transact("readwrite", (s) => {
    s.delete(key + "/progress");
    s.delete(key + "/dispatch");
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

export type QueuePauseReason = "quota" | "connection" | "stopped" | "unconfirmed";

export type QueuePreview = { text: string; attachments: number };
export function queuePreview(item: QueuedPrompt | undefined): QueuePreview | undefined {
  if (!item) return;
  return {
    text: item.prompt.trim().split(/\r?\n/, 1)[0]?.slice(0, 150) || "첨부 메시지",
    attachments: item.files.length,
  };
}
export type QueueControl = { held?: boolean; reason?: QueuePauseReason };
export const readQueueControl = (key: string) =>
  transact<QueueControl | undefined>("readonly", s => s.get(key + "/queue-control"));
export const writeQueueControl = (key: string, control: QueueControl) =>
  control.held || control.reason
    ? transact("readwrite", s => s.put(control, key + "/queue-control"))
    : transact("readwrite", s => s.delete(key + "/queue-control"));

type WaitingSummary = { queued: number; next?: QueuePreview };
export type QueueSummary = WaitingSummary & QueueControl;

export const readWaiting = (key: string) =>
  transact<QueuedPrompt[] | undefined>("readonly", store => store.get(key + "/waiting"));
export const writeWaiting = (key: string, items: QueuedPrompt[]) =>
  items.length ? transact("readwrite", store => {
    const summary: WaitingSummary = { queued: items.length, next: queuePreview(items[0]) };
    store.delete(key + "/count");
    store.put(summary, key + "/queue-summary");
    return store.put(items, key + "/waiting");
  }) : transact("readwrite", store => {
    store.delete(key + "/count");
    store.delete(key + "/queue-summary");
    return store.delete(key + "/waiting");
  });

export async function readQueueSummaries(scope: string) {
  const prefix = JSON.stringify([scope]).slice(0, -1) + ",";
  const keys = await transact("readonly", store =>
    store.getAllKeys(IDBKeyRange.bound(prefix, prefix + "\uffff")));
  const queueKeys = new Set<string>();
  const checkpoints = new Set<string>();
  for (const entry of keys) {
    if (typeof entry !== "string") continue;
    if (entry.endsWith("\"]")) {
      checkpoints.add(entry);
      queueKeys.add(entry);
    } else if (/\/(waiting|queue-control)$/.test(entry)) queueKeys.add(entry.slice(0, entry.lastIndexOf("/")));
  }
  const summaries = new Map<string, QueueSummary>();
  await Promise.all([...queueKeys].map(async key => {
    const [, page] = JSON.parse(key);
    const [summary, control, checkpoint] = await Promise.all([
      transact<WaitingSummary | undefined>("readonly", s => s.get(key + "/queue-summary")),
      readQueueControl(key),
      checkpoints.has(key) ? loadCheckpoint(key) : undefined,
    ]);
    let waiting = summary;
    if (!waiting || checkpoint) {
      const items = await readWaiting(key);
      waiting = { queued: items?.length ?? 0, next: queuePreview(items?.find(item => item.id !== checkpoint?.id)) };
    }
    const reason = checkpoint?.unconfirmed ? "unconfirmed" : control?.reason;
    if (waiting.queued || reason) summaries.set(page, { ...waiting, ...control, reason });
  }));
  return summaries;
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
  id:string; turn:number; runId?:string; title:string; page:string; date:string;
  before:string; after:string; content?:string; citations?:string[]; group?:string; state:"pending"|"applied"|"undone"|"conflict";
};
const applicationPrefix=(session:string)=>session+"/note-application/";
export type NoteApplicationLink={id:string;session:string;turn:number;runId?:string;date:string};
const linkPrefix=(scope:string,page:string)=>JSON.stringify([scope,page])+"/application-link/";
export const saveNoteApplication=(session:string,record:NoteApplication)=>
  transact("readwrite",store=>{
    const [scope,page]=JSON.parse(session) as [string,string];
    const key=linkPrefix(scope,record.page)+record.id;
    if(record.state==="applied"){
      const link:NoteApplicationLink={id:record.id,session:page,turn:record.turn,runId:record.runId,date:record.date};
      store.put(link,key);
    }else if(record.state==="undone") store.delete(key);
    return store.put(record,applicationPrefix(session)+record.id);
  });
export const removeNoteApplication=(session:string,id:string)=>
  transact("readwrite",store=>store.delete(applicationPrefix(session)+id));
export const readNoteApplications=(session:string)=>{
  const prefix=applicationPrefix(session);
  return transact<NoteApplication[]>("readonly",store=>store.getAll(IDBKeyRange.bound(prefix,prefix+"\uffff")));
};

export async function readApplicationLinks(scope:string,page:string){
  const prefix=linkPrefix(scope,page);
  return transact<NoteApplicationLink[]>("readonly",store=>store.getAll(IDBKeyRange.bound(prefix,prefix+"\uffff")));
}

export async function indexExistingApplications(scope:string){
  const prefix=JSON.stringify([scope]).slice(0,-1)+",";
  const marker=JSON.stringify([scope])+"/application-link-indexed";
  if(await transact("readonly",store=>store.get(marker))) return;
  const keys=await transact("readonly",store=>store.getAllKeys(IDBKeyRange.bound(prefix,prefix+"\uffff")));
  const records=keys.filter((key):key is string=>typeof key==="string" && /\]\/note-application\/[^/]+$/.test(key));
  await transact("readwrite",store=>{
    for(const key of records){
      const request=store.get(key);
      request.onsuccess=()=>{
        const record:NoteApplication|undefined=request.result;
        if(record?.state!=="applied")return;
        const [,session]=JSON.parse(key.slice(0,key.lastIndexOf("/note-application/")));
        const link:NoteApplicationLink={id:record.id,session,turn:record.turn,runId:record.runId,date:record.date};
        store.put(link,linkPrefix(scope,record.page)+record.id);
      };
    }
    return store.put(true,marker);
  });
}
export type ApplicationProposal={note:import("./types").Note;body:string;answer:string;block:number;checked:boolean;problem?:string;retryable?:boolean;operation?:string;group?:string};
export type ApplicationDraft={
  origin:{answer:string;turn:number;runId?:string;citations?:string[]};
  answer:string; id:string; baseline?:import("./types").Note; block:number;
  proposals:ApplicationProposal[];
};
export const readApplicationDraft=(session:string)=>transact<ApplicationDraft|undefined>("readonly",s=>s.get(session+"/application-draft"));
export const writeApplicationDraft=(session:string,draft?:ApplicationDraft)=>draft
  ? transact("readwrite",s=>s.put(draft,session+"/application-draft"))
  : transact("readwrite",s=>s.delete(session+"/application-draft"));

export const readOfficeReview=(session:string)=>transact<import("./review-export").OfficeReview|undefined>("readonly",s=>s.get(session+"/office-review"));
export const writeOfficeReview=(session:string,review:import("./review-export").OfficeReview,archive=false)=>
  transact("readwrite",s=>{
    if(archive)s.put(review,session+"/office-history/"+review.reviewedAt+"-"+crypto.randomUUID());
    return s.put(review,session+"/office-review");
  });
export const readNoteApplication=(session:string,id:string)=>
  transact<NoteApplication|undefined>("readonly",s=>s.get(applicationPrefix(session)+id));

export type OfficeDraft={
  identity:string; form:string; advanced:boolean; fields:import("./office-form").FormField[];
  values:Record<string,string|number|boolean>; json:string; preview?:import("./review-export").FieldReview[];
  sources:Record<string,string[]>; files:InputFile[]; conflicts:Record<string,string>; accepted:string[]; responseId?:string;
};
export async function readOfficeDraft(session:string,identity:string){
  const key=session+"/office-draft/";
  const last=await transact<string|undefined>("readonly",s=>s.get(key+"latest"));
  const [exact,previous]=await Promise.all([identity,last].map(id=>id?transact<OfficeDraft|undefined>("readonly",s=>s.get(key+id)):undefined));
  return {exact,previous:last!==identity?previous:undefined};
}
export const writeOfficeDraft=(session:string,draft:OfficeDraft)=>
  transact("readwrite",s=>{s.put(draft.identity,session+"/office-draft/latest");return s.put(draft,session+"/office-draft/"+draft.identity);});

export type WorkspaceReviewEntry=
  | {kind:"note";session:string;record:NoteApplication}
  | {kind:"office";session:string;record:import("./review-export").OfficeReview};
export async function readWorkspaceReviews(scope:string):Promise<WorkspaceReviewEntry[]>{
  const prefix=JSON.stringify([scope]).slice(0,-1)+",";
  const keys=await transact("readonly",s=>s.getAllKeys(IDBKeyRange.bound(prefix,prefix+"\uffff")));
  const reviewKeys=keys.filter((key):key is string=>typeof key==="string" && (/\]\/note-application\/[^/]+$/.test(key) || key.endsWith("]/office-review") || /\]\/office-history\/[^/]+$/.test(key)));
  const db=await open();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction("runs","readonly"), store=transaction.objectStore("runs");
    const entries:WorkspaceReviewEntry[]=[];
    for(const key of reviewKeys){
      const request=store.get(key);
      request.onsuccess=()=>{
        if(!request.result)return;
        const latestOffice=key.endsWith("]/office-review");
        const archivedOffice=key.includes("]/office-history/");
        const office=latestOffice || archivedOffice;
        const end=key.lastIndexOf(latestOffice?"/office-review":archivedOffice?"/office-history/":"/note-application/");
        const [,session]=JSON.parse(key.slice(0,end));
        entries.push(office?{kind:"office",session,record:request.result}:{kind:"note",session,record:request.result});
      };
    }
    transaction.oncomplete=()=>{
      const seen=new Set<string>();
      resolve(entries.filter(entry=>{
        if(entry.kind==="note")return true;
        const key=JSON.stringify([entry.session,entry.record.identity,entry.record.reviewedAt]);
        if(seen.has(key))return false;
        seen.add(key);return true;
      }));
    };
    transaction.onabort=()=>reject(transaction.error || Error("검토 이력을 읽지 못했습니다."));
  });
}

export type ReviewSlot={session:string;slot:string;value:unknown};
const reviewSlotPattern=/^(?:application-draft|note-application\/[\w-]+|office-review|office-history\/[\w:.-]+|office-draft\/(?:[a-f0-9]{64}|latest)|office-template)$/;
export const isReviewSlot=(slot:string)=>reviewSlotPattern.test(slot);
export async function reviewSlots(scope:string):Promise<ReviewSlot[]>{
  const prefix=JSON.stringify([scope]).slice(0,-1)+",";
  const keys=await transact("readonly",s=>s.getAllKeys(IDBKeyRange.bound(prefix,prefix+"\uffff")));
  const result=await Promise.all(keys.flatMap(key=>{
    if(typeof key!=="string")return [];
    const split=key.lastIndexOf("]/");
    if(split<0)return [];
    const [,session]=JSON.parse(key.slice(0,split+1)) as [string,string];
    const slot=key.slice(split+2);
    if(isReviewSlot(slot) && slot!=="office-template")return [transact("readonly",s=>s.get(key)).then(value=>({session,slot,value}))];
    if(slot==="inputs")return [readDraftInputs(JSON.stringify([scope,session])).then(value=>({session,slot:"office-template",value:value?.form}))];
    return [];
  }));
  return result.filter(entry=>entry.value!==undefined);
}
export async function mergeReviewSlots(scope:string,entries:ReviewSlot[]){
  const db=await open();
  return new Promise<{restored:number;duplicates:number}>((resolve,reject)=>{
    const tx=db.transaction("runs","readwrite"), store=tx.objectStore("runs");
    let restored=0,duplicates=0;
    for(const entry of entries){
      if(!isReviewSlot(entry.slot)){tx.abort();break;}
      const session=JSON.stringify([scope,entry.session]);
      const target=session+"/"+(entry.slot==="office-template"?"inputs":entry.slot);
      const request=store.get(target);
      request.onsuccess=()=>{
        if(entry.slot==="office-template"){
          if(request.result?.form){duplicates++;return;}
          store.put({...request.result,files:request.result?.files || [],keys:request.result?.keys || [],
            templates:request.result?.templates || [],omitted:request.result?.omitted || [],form:entry.value},target);
        }else{
          if(request.result!==undefined){duplicates++;return;}
          store.put(entry.value,target);
          if(entry.slot.startsWith("note-application/")){
            const record=entry.value as NoteApplication;
            if(record.state==="applied"){
              const link:NoteApplicationLink={id:record.id,session:entry.session,turn:record.turn,runId:record.runId,date:record.date};
              store.put(link,linkPrefix(scope,record.page)+record.id);
            }
          }
        }
        restored++;
      };
    }
    tx.oncomplete=()=>resolve({restored,duplicates});
    tx.onabort=()=>reject(tx.error || Error("검토 백업을 복원하지 못했습니다."));
  });
}
