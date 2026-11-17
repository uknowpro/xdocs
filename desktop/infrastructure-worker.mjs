import { parentPort, workerData } from "node:worker_threads";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseInfrastructure } from "./infrastructure-reader.mjs";
try {
  if ((await stat(workerData.file)).size > 20 * 1024 * 1024)
    throw Error("입력 파일은 20 MB 이하만 지원합니다.");
  parentPort.postMessage({
    result: parseInfrastructure(
      await readFile(workerData.file, "utf8"),
      path.basename(workerData.file),
    ),
  });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
