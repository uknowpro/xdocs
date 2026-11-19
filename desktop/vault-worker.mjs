import { parentPort, workerData } from "node:worker_threads";
import { Vault } from "./store.mjs";
const vault = await Vault.open(workerData.root, true);
let queue = Promise.resolve();
const allowed = new Set([
  "snapshot",
  "backup",
  "readNote",
  "refresh",
  "create",
  "save",
  "trash",
  "trashPages",
  "search",
  "history",
  "restoreHistory",
  "listTrash",
  "purgeTrash",
  "restoreTrash",
  "addAttachment",
  "readAttachment",
  "close",
]);
parentPort.on("message", ({ id, method, args }) => {
  queue = queue.then(async () => {
    try {
      if (!allowed.has(method)) throw new Error("Unknown vault operation");
      const result = await vault[method](...args);
      parentPort.postMessage({ id, result });
    } catch (e) {
      parentPort.postMessage({
        id,
        error: { message: e.message, code: e.code },
      });
    }
  });
});
parentPort.postMessage({ ready: true, root: vault.root });
