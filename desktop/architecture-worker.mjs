import { parentPort, workerData } from "node:worker_threads";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseTerraformFiles } from "./architecture-reader.mjs";
try {
  if (!Array.isArray(workerData.files) || workerData.files.length > 100)
    throw Error("최대 100개 파일을 선택하세요.");
  let bytes = 0;
  const files = [];
  for (const file of workerData.files) {
    const info = await stat(file);
    bytes += info.size;
    if (!info.isFile() || bytes > 2_000_000)
      throw Error("Terraform 입력은 총 2 MB 이하의 파일만 지원합니다.");
    files.push({
      name: path.basename(file),
      content: await readFile(file, "utf8"),
    });
  }
  parentPort.postMessage({ result: await parseTerraformFiles(files) });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
