import { useSyncExternalStore } from "react";

type Slot = {
  signal: AbortSignal;
  start: (release: () => void) => void;
  cancel: () => void;
};
const queues = new Map<string, { active: number; waiting: Slot[] }>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function serverOrigin(endpoint: string) {
  try {
    return new URL(endpoint).origin;
  } catch {
    return "";
  }
}
function capacity(origin: string) {
  return Math.min(
    8,
    Math.max(
      1,
      Number(localStorage.getItem("xdocs.xcode.capacity." + origin)) || 2,
    ),
  );
}
export function useCapacity(origin: string) {
  return useSyncExternalStore(subscribe, () => capacity(origin));
}
export function setCapacity(origin: string, value: number) {
  localStorage.setItem("xdocs.xcode.capacity." + origin, String(value));
  drain(origin);
  for (const notify of listeners) notify();
}
function drain(origin: string) {
  const queue = queues.get(origin);
  if (!queue) return;
  while (queue.active < capacity(origin) && queue.waiting.length) {
    const slot = queue.waiting.shift()!;
    slot.signal.removeEventListener("abort", slot.cancel);
    queue.active++;
    slot.start(() => {
      queue.active--;
      drain(origin);
    });
  }
  if (!queue.active && !queue.waiting.length) queues.delete(origin);
}
export async function acquireServer(origin: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const queue = queues.get(origin) ?? { active: 0, waiting: [] };
  queues.set(origin, queue);
  return new Promise<() => void>((resolve, reject) => {
    const slot: Slot = {
      signal,
      start: resolve,
      cancel() {
        queue.waiting = queue.waiting.filter((item) => item !== slot);
        reject(signal.reason);
        drain(origin);
      },
    };
    signal.addEventListener("abort", slot.cancel, { once: true });
    queue.waiting.push(slot);
    drain(origin);
  });
}
