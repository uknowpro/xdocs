import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { readSpreadsheet } from "../desktop/spreadsheet-reader.mjs";
import { importSpreadsheet } from "../desktop/spreadsheet-import.mjs";
import {
  toTSV,
  parseDelimited,
  encodeWorkbook,
  decodeWorkbook,
  replaceWorkbook,
} from "../shared/tabular.mjs";
test("TSV preserves Korean, empty cells, quotes and multiline fields", () => {
  const rows = [
    ["한글", "", "a\tb", '"인용"', "여러\n줄"],
    ["=1+1", "마지막", ""],
  ];
  assert.deepEqual(parseDelimited(toTSV(rows)), rows);
  assert.deepEqual(parseDelimited("\uFEFFa\t\r\n"), [["a", ""]]);
  assert.throws(() => parseDelimited('"끝나지 않음'));
});
test("sheet notes preserve fenced text and literal replacement tokens", () => {
  const book = {
    version: 1,
    sheets: [{ id: "1", name: "시트", rows: [["```", "\n```", "$&", "$`"]] }],
  };
  const body = "# 시트\n\n" + encodeWorkbook(book) + "\n";
  assert.deepEqual(decodeWorkbook(body), book);
  assert.deepEqual(decodeWorkbook(replaceWorkbook(body, book)), book);
});
test("XLSX worker imports visible sheets, blanks, merged values and cached formula results without changing source", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "xdocs-sheets-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "테스트.xlsx"),
    b = new ExcelJS.Workbook();
  const first = b.addWorksheet("매출");
  first.addRow(["이름", "", "수량"]);
  first.addRow(["한글", null, 3]);
  first.getCell("D2").value = { formula: "C2*2", result: 6 };
  first.mergeCells("A3:B3");
  first.getCell("A3").value = "합침";
  b.addWorksheet("숨김", { state: "hidden" }).addRow(["비공개"]);
  b.addWorksheet("예산").addRow(["여러\n줄", '따옴표"']);
  await b.xlsx.writeFile(file);
  const before = await readFile(file);
  const { workbook } = await importSpreadsheet(file);
  assert.deepEqual(
    workbook.sheets.map((s) => s.name),
    ["매출", "예산"],
  );
  assert.equal(workbook.sheets[0].rows[1][1], "");
  assert.equal(workbook.sheets[0].rows[1][3], "6");
  assert.equal(workbook.sheets[0].rows[2][1], "");
  assert.deepEqual(await readFile(file), before);
  await writeFile(
    path.join(root, "protected.xlsx"),
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
  );
  await assert.rejects(
    readSpreadsheet(path.join(root, "protected.xlsx")),
    /암호화|읽을 수/,
  );
});
