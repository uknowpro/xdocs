import { Worker } from "node:worker_threads";
export function importInfrastructure(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./infrastructure-worker.mjs", import.meta.url),
      { workerData: { file }, resourceLimits: { maxOldGenerationSizeMb: 256 } },
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
      () => finish(Error("인프라 파일 읽기 시간이 초과되었습니다.")),
      15000,
    );
    worker.once("message", (p) =>
      finish(p.error ? Error(p.error) : null, p.result),
    );
    worker.once("error", () =>
      finish(
        Error("인프라 파일을 처리할 수 없습니다. 크기와 구조를 확인해 주세요."),
      ),
    );
    worker.once("exit", () => {
      if (!settled) finish(Error("인프라 읽기 작업이 종료되었습니다."));
    });
  });
}
