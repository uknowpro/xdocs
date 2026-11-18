import { Worker } from "node:worker_threads";
export function importArchitecture(files, project = false) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./architecture-worker.mjs", import.meta.url),
      {
        workerData: { files, project },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      },
    );
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(
      () => finish(Error("Terraform 읽기 시간이 초과되었습니다.")),
      20000,
    );
    worker.once("message", (m) =>
      finish(m.error ? Error(m.error) : null, m.result),
    );
    worker.once("error", () =>
      finish(Error("Terraform 파일을 처리할 수 없습니다.")),
    );
    worker.once("exit", () => {
      if (!settled) finish(Error("Terraform 읽기 작업이 종료되었습니다."));
    });
  });
}
