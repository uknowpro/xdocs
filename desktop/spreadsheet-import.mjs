import { Worker } from "node:worker_threads";
export function importSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./spreadsheet-worker.mjs", import.meta.url),
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
      () =>
        finish(
          Error(
            "파일 읽기 시간이 초과되었습니다. 필요한 범위만 내보내 주세요.",
          ),
        ),
      30000,
    );
    worker.once("message", (packet) =>
      finish(packet.error ? Error(packet.error) : null, packet.result),
    );
    worker.once("error", (error) => finish(error));
    worker.once("exit", () => {
      if (!settled) finish(Error("시트 읽기 작업이 종료되었습니다."));
    });
  });
}
