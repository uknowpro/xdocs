import { Worker } from "node:worker_threads";
export class VaultClient {
  static async open(root) {
    const worker = new Worker(new URL("./vault-worker.mjs", import.meta.url), {
      workerData: { root },
    });
    const client = new VaultClient(worker, root);
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        worker.off("message", onMessage);
        worker.off("error", onError);
        worker.off("exit", onExit);
      };
      const onMessage = (message) => {
        if (message.ready) {
          client.root = message.root;
          cleanup();
          resolve();
        }
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      const onExit = () => onError(client.failure);
      worker.on("message", onMessage);
      worker.once("error", onError);
      worker.once("exit", onExit);
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
    this.failure = null;
    this.closing = null;
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
    const fail = (error) => {
      this.failure ??= error;
      for (const request of this.pending.values()) request.reject(this.failure);
      this.pending.clear();
    };
    worker.on("error", fail);
    worker.on("exit", () =>
      fail(new Error("보관함 작업 프로세스가 종료되었습니다.")),
    );
  }
  call(method, args) {
    if (this.failure || this.closing)
      return Promise.reject(
        this.failure || new Error("보관함이 닫히고 있습니다."),
      );
    return new Promise((resolve, reject) => {
      const id = ++this.next;
      this.worker.postMessage({ id, method, args });
      this.pending.set(id, { resolve, reject });
    });
  }
  close() {
    if (!this.closing) {
      const closeVault = this.failure
        ? Promise.resolve()
        : this.call("close", []);
      this.closing = closeVault.finally(() => this.worker.terminate());
    }
    return this.closing;
  }
}
