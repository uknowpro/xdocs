import { parentPort, workerData } from "node:worker_threads";
import { readSpreadsheet } from "./spreadsheet-reader.mjs";
try {
  parentPort.postMessage({ result: await readSpreadsheet(workerData.file) });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
