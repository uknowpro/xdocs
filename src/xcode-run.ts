import { useSyncExternalStore } from "react";
import type { InputFile } from "./xcode-session";
import { api } from "./api";

// A running session belongs to its workspace page, independently of the visible page.
function createRun(scope: string, page: string) {
  const listeners = new Set<() => void>();
  let state = {
    pending: null as { prompt: string; files: string[]; index: number } | null,
    busy: false,
    preview: "",
    phase: "",
    error: "",
    prompt: "",
    omitted: [] as string[],
    files: [] as InputFile[],
  };
  const record = {
    scope,
    page,
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
      const changed =
        (next.busy !== undefined && next.busy !== state.busy) ||
        (next.phase !== undefined && next.phase !== state.phase);
      state = { ...state, ...next };
      if (changed) for (const notify of activity) notify();
      for (const notify of listeners) notify();
    },
    cancel() {
      const id = record.id;
      record.id = "";
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
export function useRunningPages(
  scope?: string,
): { page: string; phase: string }[] {
  return JSON.parse(
    useSyncExternalStore(subscribeActivity, () =>
      JSON.stringify(
        [...runs.values()]
          .filter((r) => r.scope === scope && r.snapshot().busy)
          .map((r) => ({ page: r.page, phase: r.snapshot().phase })),
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
