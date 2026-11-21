import { useSyncExternalStore } from "react";
import type { InputFile } from "./xcode-session";
import {readComposerDraft,writeComposerDraft,readWaiting, writeWaiting, type QueuedPrompt} from "./xcode-checkpoint";
import { api } from "./api";

// A running session belongs to its workspace page, independently of the visible page.
function createRun(scope: string, page: string) {
  const draftKey = "xdocs.xcode.draft." + JSON.stringify([scope, page]);
  let savedPrompt = "";
  try { savedPrompt = localStorage.getItem(draftKey) || ""; } catch {}
  const listeners = new Set<() => void>();
  let state = {
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
    formReview: undefined as {text:string; id:string} | undefined,
  };
  const queueKey = JSON.stringify([scope,page]);
  let writes:Promise<void> = Promise.resolve();
  let draftRevision=0;
  let draftWrite:Promise<unknown>=Promise.resolve();
  let loading:Promise<void> | undefined;
  const record = {
    submitting:false,
    activeItem:"",
    loadWaiting() {
      return loading ??= Promise.all([readWaiting(queueKey),readComposerDraft(queueKey)]).then(([items,draft])=>{
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
    draftSaved:()=>draftWrite,
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
      const changed =
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
export function sessionStatus(activity?: {phase:string; outcome:string; busy:boolean}) {
  if (!activity) return {state:"idle", label:"대기 중인 요청 없음"};
  if (!activity.busy && activity.outcome === "complete") return {state:"complete", label:"새 답변 도착"};
  if (!activity.busy && activity.outcome === "failed") return {state:"failed", label:"요청 실패"};
  const waiting = /대기열|초 후/.test(activity.phase);
  return {state:waiting ? "waiting" : "running", label:activity.phase || "요청 준비 중"};
}
export function useSessionActivity(
  scope?: string,
): { page: string; phase: string; outcome:string; busy:boolean }[] {
  return JSON.parse(
    useSyncExternalStore(subscribeActivity, () =>
      JSON.stringify(
        [...runs.values()]
          .filter((r) => r.scope === scope && (r.snapshot().busy||r.snapshot().outcome))
          .map((r) => ({ page: r.page, phase: r.snapshot().phase, outcome:r.snapshot().outcome, busy:r.snapshot().busy })),
      ),
    ),
  );
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
