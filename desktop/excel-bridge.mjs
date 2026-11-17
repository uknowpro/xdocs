import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { validateWorkbook } from "../shared/tabular.mjs";
export async function importWithExcel(source) {
  if (process.platform !== "win32")
    throw Error(
      "Excel 자동 읽기는 Windows용 Excel에서 지원합니다. 이 운영체제에서는 로컬 앱의 CSV/TSV 내보내기를 사용해 주세요.",
    );
  const directory = await mkdtemp(path.join(os.tmpdir(), "xdocs-excel-"));
  try {
    const output = path.join(directory, "workbook.json");
    await promisify(execFile)(
      path.join(
        process.env.SystemRoot || "C:\\Windows",
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
      ),
      [
        "-NoProfile",
        "-File",
        fileURLToPath(new URL("./excel-import.ps1", import.meta.url)).replace(
          /app\.asar([\\/])/,
          "app.asar.unpacked$1",
        ),
      ],
      {
        env: {
          ...process.env,
          XDOCS_EXCEL_SOURCE: source,
          XDOCS_EXCEL_RESULT: output,
        },
        maxBuffer: 1024 * 1024,
        windowsHide: false,
      },
    );
    return {
      workbook: validateWorkbook(JSON.parse(await readFile(output, "utf8"))),
      warnings: [
        "Excel 표시값을 읽었습니다. 수식·서식·매크로는 가져오지 않습니다.",
      ],
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
