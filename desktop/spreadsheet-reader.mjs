import ExcelJS from "exceljs";
import yauzl from "yauzl";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  LIMITS,
  parseDelimited,
  validateWorkbook,
} from "../shared/tabular.mjs";
async function inspectZip(file) {
  await new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error)
        return reject(
          Error(
            "암호화되었거나 읽을 수 없는 파일입니다. 로컬 Excel에서 열어 주세요.",
          ),
        );
      let bytes = 0,
        entries = 0,
        done = false;
      const fail = (message) => {
        if (done) return;
        done = true;
        zip.close();
        reject(Error(message));
      };
      zip.on("error", (e) => fail(e.message));
      zip.on("entry", (entry) => {
        bytes += entry.uncompressedSize;
        if (
          ++entries > 10000 ||
          bytes > 64 * 1024 * 1024 ||
          entry.generalPurposeBitFlag & 1
        )
          return fail(
            "암호화 또는 압축 해제 크기 제한으로 직접 읽을 수 없습니다.",
          );
        zip.readEntry();
      });
      zip.on("end", () => {
        if (!done) {
          done = true;
          resolve();
        }
      });
      zip.readEntry();
    });
  });
}
export async function readSpreadsheet(file) {
  if ((await stat(file)).size > 25 * 1024 * 1024)
    throw Error("파일은 25 MB 이하만 지원합니다.");
  const ext = path.extname(file).toLowerCase();
  let sheets = [],
    warnings = [];
  if ([".csv", ".tsv", ".txt"].includes(ext)) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await readFile(file),
    );
    sheets = [
      {
        id: randomUUID(),
        name: path.basename(file, ext).slice(0, 100),
        rows: parseDelimited(text, ext === ".csv" ? "," : "\t"),
      },
    ];
  } else if ([".xlsx", ".xlsm"].includes(ext)) {
    await inspectZip(file);
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(file);
    let total = 0;
    for (const sheet of book.worksheets) {
      if (sheet.state !== "visible") continue;
      if (
        sheet.rowCount > LIMITS.rows ||
        sheet.columnCount > LIMITS.columns ||
        (total += sheet.rowCount * sheet.columnCount) > LIMITS.cells
      )
        throw Error(
          "시트 크기 제한을 초과했습니다. 필요한 범위를 CSV/TSV로 내보내 주세요.",
        );
      const rows = [];
      for (let r = 1; r <= sheet.rowCount; r++) {
        const values = [];
        for (let c = 1; c <= sheet.columnCount; c++) {
          const cell = sheet.getCell(r, c),
            value = cell.value;
          // Preserve merged cells as a value in the master cell only.
          if (cell.isMerged && cell.master.address !== cell.address) {
            values.push("");
            continue;
          }
          if (
            value &&
            typeof value === "object" &&
            ("formula" in value || "sharedFormula" in value) &&
            value.result === undefined
          )
            warnings.push(
              "저장된 결과가 없는 수식은 빈 셀로 표시합니다. Excel에서 재계산 후 가져오세요.",
            );
          const result =
            value &&
            typeof value === "object" &&
            ("formula" in value || "sharedFormula" in value)
              ? value.result
              : value;
          values.push(
            result instanceof Date
              ? result.toISOString()
              : result == null
                ? ""
                : cell.text,
          );
        }
        rows.push(values);
      }
      sheets.push({ id: randomUUID(), name: sheet.name, rows });
    }
    warnings.push(
      "수식은 저장된 결과만 가져오며 재계산하지 않습니다. 서식·차트·매크로는 포함하지 않습니다.",
    );
  } else throw Error("이 형식은 로컬 Excel에서 열어 변환해 주세요.");
  return {
    workbook: validateWorkbook({ version: 1, sheets }),
    warnings: [...new Set(warnings)],
  };
}
