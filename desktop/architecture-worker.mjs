import { projectSources } from "./local-modules.mjs";
import { parentPort, workerData } from "node:worker_threads";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseTerraformFiles } from "./architecture-reader.mjs";
try {
  if (!Array.isArray(workerData.files) || workerData.files.length > 100)
    throw Error("최대 100개 파일을 선택하세요.");
  let bytes = 0;
  let count = 0;
  async function read(file, name) {
    const info = await stat(file);
    bytes += info.size;
    if (++count > 100 || !info.isFile() || bytes > 2_000_000)
      throw Error(
        "Terraform 입력은 최대 100개 파일, 총 2 MB 이하만 지원합니다.",
      );
    return { name, content: await readFile(file, "utf8") };
  }
  const files = [];
  if (workerData.project)
    files.push(...(await projectSources(workerData.files[0], read)));
  else
    for (const file of workerData.files)
      files.push(await read(file, path.basename(file)));
  parentPort.postMessage({ result: await parseTerraformFiles(files) });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
