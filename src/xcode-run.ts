import { useEffect, useState, useSyncExternalStore } from "react";
import type { InputFile, SessionSettingsDraft, SessionToken } from "./xcode-session";
import {readQueueCounts,readComposerDraft,writeComposerDraft,readWaiting, writeWaiting, type QueuedPrompt} from "./xcode-checkpoint";
import {fileKey,restoreFileKey,readDraftInputs,writeDraftInputs} from "./xcode-checkpoint";
import {inspectForm,templateFiles} from "./office-form";
import { api } from "./api";

// A running session belongs to its workspace page, independently of the visible page.
function createRun(scope: string, page: string) {
  const draftKey = "xdocs.xcode.draft." + JSON.stringify([scope, page]);
  let savedPrompt = "";
  try { savedPrompt = localStorage.getItem(draftKey) || ""; } catch {}
  const listeners = new Set<() => void>();
  let state = {
    failedInput: undefined as QueuedPrompt | undefined,
    waiting: [] as QueuedPrompt[],
    queuePaused: true,
    queueReady: false,
    pending: null as { prompt: string; files: string[]; index: number } | null,
    busy: false,
    outcome:"" as ""|"failed"|"complete",
    preview: "",
    phase: "",
    error: "",
    prompt: savedPrompt,
    draftError: "",
    omitted: [] as string[],
    files: [] as InputFile[],
    form: undefined as import("./office-form").OfficeTemplate | undefined,
    formReview: undefined as {text:string; id:string;files?:InputFile[]} | undefined,
  };
  const queueKey = JSON.stringify([scope,page]);
  let writes:Promise<void> = Promise.resolve();
  let draftRevision=0;
  let draftWrite:Promise<unknown>=Promise.resolve();
  let inputsRevision=0;
  let inputsWrite:Promise<unknown>=Promise.resolve();
  let loading:Promise<void> | undefined;
  const record = {
    submitting:false,
    steering:"",
    activeItem:"",
    settingsDraft: undefined as SessionSettingsDraft | undefined,
    sessionToken: { value: "", origin: "" } as SessionToken,
    loadWaiting() {
      return loading ??= Promise.all([readWaiting(queueKey),readComposerDraft(queueKey),readDraftInputs(queueKey)]).then(async([items,draft,inputs])=>{
        if (inputs && !inputsRevision) {
          const form=inputs.form ? await inspectForm(inputs.form) : undefined;
          if (!inputsRevision) {
            inputs.files.forEach((f,i)=>{
              if(inputs.keys[i]) restoreFileKey(f,inputs.keys[i]);
              if(inputs.templates[i]) templateFiles.set(f,inputs.templates[i]!);
            });
            state={...state,files:inputs.files,omitted:inputs.omitted,form};
          }
        }
        if (!draftRevision && draft!==undefined) {
          state={...state,prompt:draft};
          if (!draft) {try {localStorage.removeItem(draftKey);} catch {}}
        }
        record.patch({waiting:items || [],queueReady:true});
      }).catch(e=>{loading=undefined; throw e;});
    },
    updateWaiting(change:(items:QueuedPrompt[])=>QueuedPrompt[]) {
      const operation = writes.then(async()=>{
        await record.loadWaiting();
        const items=change(state.waiting);
        await writeWaiting(queueKey,items);
        record.patch({waiting:items});
      });
      writes=operation.catch(()=>{});
      return operation;
    },
    settled:()=>writes,
    draftSaved:()=>Promise.all([draftWrite,inputsWrite]),
    scope,
    page,
    reading: {top:0, follow:true},
    id: "",
    enabled: false,
    automatic: false,
    request: null as AbortController | null,
    wait: null as AbortController | null,
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    patch(next: Partial<typeof state>) {
      if (next.files || next.omitted || "form" in next) {
        const current={...state,...next};
        const revision=++inputsRevision;
        inputsWrite=inputsWrite.catch(()=>{}).then(()=>{
          if(revision!==inputsRevision) return;
          return writeDraftInputs(queueKey,{files:current.files,keys:current.files.map(fileKey),
            templates:current.files.map(f=>templateFiles.get(f)),omitted:current.omitted,
            form:current.form ? new File([new Uint8Array(current.form.bytes)],current.form.name) : undefined});
        });
        void inputsWrite.catch(()=>record.patch({draftError:"첨부 초안을 저장하지 못했습니다."}));
      }
      if (next.prompt !== undefined) {
        const value=next.prompt;
        const revision=++draftRevision;
        draftWrite=draftWrite.catch(()=>{}).then(()=>{
          if(revision===draftRevision) return writeComposerDraft(queueKey,value);
        });
        void draftWrite.catch(()=>record.patch({draftError:"초안을 기기에 저장하지 못했습니다."}));
        try {
          if (next.prompt) localStorage.setItem(draftKey, next.prompt);
          else localStorage.removeItem(draftKey);
          next.draftError = "";
        } catch { next.draftError = "초안을 기기에 저장하지 못했습니다."; }
      }
      const changed = next.waiting !== undefined || next.queuePaused !== undefined ||
        (next.outcome!==undefined && next.outcome!==state.outcome) ||
        (next.busy !== undefined && next.busy !== state.busy) ||
        (next.phase !== undefined && next.phase !== state.phase);
      state = { ...state, ...next };
      if (changed) for (const notify of activity) notify();
      for (const notify of listeners) notify();
    },
    cancel() {
      const id = record.id;
      record.id = "";
      record.patch({queuePaused:true});
      record.request?.abort();
      record.wait?.abort();
      if (id) void api.xcodeCancel?.(id);
    },
  };
  return record;
}
const runs = new Map<string, ReturnType<typeof createRun>>();
const activity = new Set<() => void>();
function subscribeActivity(cb: () => void) {
  activity.add(cb);
  return () => {
    activity.delete(cb);
  };
}
export type SessionActivity = {
  page:string; phase:string; outcome:string; busy:boolean; queued:number;
};
export function sessionStatus(activity?: SessionActivity) {
  const count = activity?.queued ?? 0;
  const badge = count ? (activity?.busy ? "응답 중" : "일시정지") + " · 대기 " + count + "개" : "";
  if (!activity) return {state:"idle", label:"대기 중인 요청 없음", badge};
  if (!activity.busy && count) return {state:"waiting", label:badge, badge};
  if (!activity.busy && activity.outcome === "complete") return {state:"complete", label:"새 답변 도착", badge};
  if (!activity.busy && activity.outcome === "failed") return {state:"failed", label:"요청 실패", badge};
  const waiting = /대기열|초 후/.test(activity.phase);
  return {state:waiting ? "waiting" : "running", label:[activity.phase || "요청 준비 중",badge].filter(Boolean).join(" · "), badge};
}
export function useSessionActivity(scope?: string): SessionActivity[] {
  const [restored,setRestored]=useState<{scope:string; counts:Map<string,number>}>();
  useEffect(()=>{
    let current=true;
    if (scope) void readQueueCounts(scope).then(counts=>{
      if (current) setRestored({scope,counts});
    }).catch(()=>{});
    return ()=>{current=false;};
  },[scope]);
  const live:SessionActivity[]=JSON.parse(useSyncExternalStore(subscribeActivity, () => JSON.stringify(
    [...runs.values()].filter(run => run.scope === scope).flatMap(run => {
      const {busy, phase, outcome, waiting} = run.snapshot();
      const queued = waiting.length - Number(busy && waiting.some(item => item.id === run.activeItem));
      return busy || outcome || queued ? [{page:run.page, busy, phase, outcome, queued}] : [];
    })
  )));
  if (restored && restored.scope===scope) {
    for (const [page,queued] of restored.counts) {
      const run=runs.get(JSON.stringify([scope,page]));
      if (queued && !run?.snapshot().queueReady && !live.some(item=>item.page===page))
        live.push({page,queued,phase:"",outcome:"",busy:false});
    }
  }
  return live;
}
export function sessionRun(scope: string, page: string) {
  const key = JSON.stringify([scope, page]);
  const existing = runs.get(key);
  if (existing) return existing;
  const created = createRun(scope, page);
  runs.set(key, created);
  return created;
}
export function stopWorkspaceRuns(scope?: string) {
  for (const run of runs.values())
    if (run.scope === scope && run.snapshot().busy) run.cancel();
}
export function leaveWorkspace(scope: string) {
  for (const [key, r] of runs)
    if (r.scope === scope) {
      r.cancel();
      runs.delete(key);
    }
}
export function waitForRetry(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(Error("자동 재요청이 해제되었습니다."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
