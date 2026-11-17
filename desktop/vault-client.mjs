import { Worker } from "node:worker_threads";
export class VaultClient {
  static async open(root) {
    const worker = new Worker(new URL("./vault-worker.mjs", import.meta.url), {
      workerData: { root },
    });
    const client = new VaultClient(worker, root);
    await new Promise((resolve, reject) => {
      const onMessage = (message) => {
        if (message.ready) {
          worker.off("error", onError);
          worker.off("message", onMessage);
          resolve();
        }
      };
      const onError = (error) => {
        worker.off("message", onMessage);
        reject(error);
      };
      worker.on("message", onMessage);
      worker.once("error", onError);
    });
    return new Proxy(client, {
      get(target, key) {
        if (key in target || key === "then") return target[key];
        return (...args) => target.call(key, args);
      },
    });
  }
  constructor(worker, root) {
    this.worker = worker;
    this.root = root;
    this.next = 0;
    this.pending = new Map();
    worker.on("message", ({ id, result, error }) => {
      const request = this.pending.get(id);
      if (!request) return;
      this.pending.delete(id);
      error
        ? request.reject(
            Object.assign(new Error(error.message), { code: error.code }),
          )
        : request.resolve(result);
    });
    worker.on("error", (error) => {
      for (const p of this.pending.values()) p.reject(error);
      this.pending.clear();
    });
    worker.on("exit", () => {
      for (const p of this.pending.values())
        p.reject(new Error("보관함 작업 프로세스가 종료되었습니다."));
      this.pending.clear();
    });
  }
  call(method, args) {
    return new Promise((resolve, reject) => {
      const id = ++this.next;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, method, args });
    });
  }
  async close() {
    try {
      await this.call("close", []);
    } finally {
      await this.worker.terminate();
    }
  }
}
