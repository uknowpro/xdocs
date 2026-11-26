import { useEffect, useState, useSyncExternalStore } from "react";
import type { InputFile, SessionSettingsDraft, SessionToken } from "./xcode-session";
import {
  loadCheckpoint, queuePreview, readQueueControl, readQueueSummaries, writeQueueControl,
  readComposerDraft, writeComposerDraft, readWaiting, writeWaiting,
  type QueuedPrompt, type QueuePauseReason, type QueueSummary,
} from "./xcode-checkpoint";
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
    queueHeld: false,
    pauseReason: undefined as QueuePauseReason | undefined,
    recoveryItem: "",
    priorityItem: "",
    queueReady: false,
    pending: null as { prompt: string; files: string[]; index: number } | null,
    busy: false,
    submitting: false,
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
  let controlWrite: Promise<unknown> = Promise.resolve();
  let draftRevision=0;
  let draftWrite:Promise<unknown>=Promise.resolve();
  let inputsRevision=0;
  let inputsWrite:Promise<unknown>=Promise.resolve();
  let loading:Promise<void> | undefined;
  const record = {
    steering:"",
    activeItem:"",
    settingsDraft: undefined as SessionSettingsDraft | undefined,
    sessionToken: { value: "", origin: "" } as SessionToken,
    loadWaiting() {
      return loading ??= Promise.all([
        readWaiting(queueKey), readComposerDraft(queueKey), readDraftInputs(queueKey),
        readQueueControl(queueKey), loadCheckpoint(queueKey),
      ]).then(async ([items, draft, inputs, control, checkpoint]) => {
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
        state = {
          ...state,
          queueHeld: Boolean(control?.held),
          pauseReason: checkpoint?.unconfirmed ? "unconfirmed" : control?.reason,
          recoveryItem: checkpoint?.id ?? "",
        };
        record.patch({waiting:items || [],queueReady:true});
      }).catch(e=>{loading=undefined; throw e;});
    },
    updateWaiting(change:(items:QueuedPrompt[])=>QueuedPrompt[]) {
      const operation = writes.then(async()=>{
        await record.loadWaiting();
        const items=change(state.waiting);
        await writeWaiting(queueKey,items);
        record.patch({
          waiting: items,
          priorityItem: items.some(item => item.id === state.priorityItem) ? state.priorityItem : "",
        });
      });
      writes=operation.catch(()=>{});
      return operation;
    },
    settled:()=>writes,
    controlSaved: () => controlWrite,
    async holdQueue() {
      await record.loadWaiting();
      if (state.queueHeld) return;
      record.patch({ queueHeld: true });
      await record.controlSaved();
    },
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
      if ((next.queueHeld !== undefined && next.queueHeld !== state.queueHeld) ||
          ("pauseReason" in next && next.pauseReason !== state.pauseReason)) {
        const control = { held: next.queueHeld ?? state.queueHeld,
          reason: "pauseReason" in next ? next.pauseReason : state.pauseReason };
        controlWrite = controlWrite.catch(() => {}).then(() => writeQueueControl(queueKey, control));
        void controlWrite.catch(() => record.patch({ error: "대기열 상태를 저장할 수 없습니다." }));
      }
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
      const changed = next.waiting !== undefined || next.queuePaused !== undefined || next.queueHeld !== undefined || "pauseReason" in next || "recoveryItem" in next ||
        (next.outcome!==undefined && next.outcome!==state.outcome) ||
        (next.busy !== undefined && next.busy !== state.busy) ||
        (next.phase !== undefined && next.phase !== state.phase);
      state = { ...state, ...next };
      if (changed) for (const notify of activity) notify();
      for (const notify of listeners) notify();
    },
    cancel(queue: "pause" | "continue" = "pause") {
      const id = record.id;
      record.steering = queue === "continue" ? id : "";
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
export type SessionActivity = QueueSummary & {
  page:string; phase:string; outcome:string; busy:boolean;
};
export function queuePauseLabel(reason?: QueuePauseReason) {
  switch (reason) {
    case "quota": return "사용량 또는 요청 한도에 도달함";
    case "connection": return "모델 연결이 끊김";
    case "stopped": return "요청 중지";
    case "unconfirmed": return "전송 결과 확인 필요";
    default: return "";
  }
}
export function sessionStatus(activity?: SessionActivity) {
  const count = activity?.queued ?? 0;
  const badge = count ? (activity?.held || !activity?.busy ? "일시정지" : "응답 중") + " · 대기 " + count + "개" : "";
  if (!activity) return {state:"idle", label:"대기 중인 요청 없음", badge};
  if (!activity.busy && activity.reason && activity.reason !== "stopped")
    return {state:"failed", label:queuePauseLabel(activity.reason), badge};
  if (!activity.busy && count) return {state:"waiting", label:badge, badge};
  if (!activity.busy && activity.outcome === "complete") return {state:"complete", label:"새 답변 도착", badge};
  if (!activity.busy && activity.outcome === "failed") return {state:"failed", label:"요청 실패", badge};
  const waiting = /대기열|초 후/.test(activity.phase);
  return {state:waiting ? "waiting" : "running", label:[activity.phase || "요청 준비 중",badge].filter(Boolean).join(" · "), badge};
}
export function useSessionActivity(scope?: string): SessionActivity[] {
  const [restored,setRestored]=useState<{scope:string; summaries:Map<string,QueueSummary>}>();
  useEffect(()=>{
    let current=true;
    if (scope) void readQueueSummaries(scope).then(summaries=>{
      if (current) setRestored({scope,summaries});
    }).catch(()=>{});
    return ()=>{current=false;};
  },[scope]);
  const live:SessionActivity[]=JSON.parse(useSyncExternalStore(subscribeActivity, () => JSON.stringify(
    [...runs.values()].filter(run => run.scope === scope).flatMap(run => {
      const { busy, phase, outcome, waiting, queueHeld, pauseReason } = run.snapshot();
      const state = run.snapshot();
      const items = waiting.filter(item => !busy || item.id !== run.activeItem);
      const next = items.find(item => item.id !== (state.failedInput?.id ?? state.recoveryItem));
      const queued = items.length;
      return busy || outcome || queued || pauseReason ? [{
        page: run.page, busy, phase, outcome, queued, next: queuePreview(next), held: queueHeld, reason: pauseReason,
      }] : [];
    })
  )));
  if (restored && restored.scope===scope) {
    for (const [page,summary] of restored.summaries) {
      const run=runs.get(JSON.stringify([scope,page]));
      if (!run?.snapshot().queueReady && !live.some(item=>item.page===page))
        live.push({ page, ...summary, phase: "", outcome: "", busy: false });
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
