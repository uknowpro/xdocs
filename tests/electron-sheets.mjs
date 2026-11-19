import { _electron as electron } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
const temp = await mkdtemp(path.join(os.tmpdir(), "xdocs-sheet-ui-")),
  data = path.join(temp, "app"),
  vault = path.join(temp, "vault");
await mkdir(data);
await mkdir(vault);
await writeFile(
  path.join(data, "workspace.json"),
  JSON.stringify({ root: vault }),
);
const file = path.join(temp, "분기 예산.xlsx"),
  b = new ExcelJS.Workbook();
b.addWorksheet("매출").addRows([
  ["월", "제품", "매출"],
  ["1월", "노트", 1200],
  ["2월", "팀", 2400],
]);
b.addWorksheet("예산").addRows([
  ["항목", "계획"],
  ["개발", 3000],
]);
await b.xlsx.writeFile(file);
const before = await readFile(file);
const app = await electron.launch({
  args: process.env.XDOCS_EXECUTABLE ? [] : ["."],
  ...(process.env.XDOCS_EXECUTABLE
    ? { executablePath: process.env.XDOCS_EXECUTABLE }
    : {}),
  env: { ...process.env, XDOCS_TEST_DATA: data },
});
try {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  const page = await app.firstWindow();
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "Excel·CSV 시트 가져오기" }).click();
  await page.getByRole("textbox", { name: "매출 C2", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "매출 C2", exact: true })
      .inputValue(),
    "1200",
  );
  await page.getByRole("tab", { name: "예산", exact: true }).click();
  await page
    .getByRole("textbox", { name: "예산 B2", exact: true })
    .fill("3500");
  await page.waitForFunction(() =>
    document
      .querySelector(".save-state")
      ?.textContent?.includes("로컬에 저장됨"),
  );
  const saved = await page.evaluate(() => window.xdocs.refresh());
  const full = await page.evaluate(
    (id) => window.xdocs.readNote(id),
    saved.notes[0].id,
  );
  assert.match(full.body, /3500/);
  assert.deepEqual(await readFile(file), before);
  await page.getByRole("tab", { name: "매출", exact: true }).click();
  await page.evaluate(() => {
    document.querySelector(".workspace")?.scrollTo(0, 0);
    document.querySelector("main")?.scrollTo(0, 0);
    document.activeElement?.blur();
  });
  await page.waitForFunction(() => !document.querySelector(".toast"));
  await page.screenshot({ path: "test-results/sheet-table.png" });
  const protectedFile = path.join(temp, "잠긴 파일.xlsx");
  await writeFile(protectedFile, Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({ response: 2 });
  }, protectedFile);
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "Excel·CSV 시트 가져오기" }).click();
  await page
    .getByRole("button", { name: "원본 파일 열기", exact: true })
    .waitFor();
  const directory = path.join(temp, "팀 자료");
  const nested = path.join(directory, "회계");
  await mkdir(nested, { recursive: true });
  await b.xlsx.writeFile(path.join(nested, "결산.xlsx"));
  await writeFile(path.join(directory, "월별.tsv"), "월\t매출\n1월\t1200");
  await app.evaluate(({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, directory);
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "Excel·CSV 폴더 가져오기" }).click();
  await page.getByRole("button", { name: "결산", exact: true }).click();
  await page.getByRole("tab", { name: "예산", exact: true }).waitFor();
  const imported = await page.evaluate(() => window.xdocs.refresh());
  const byTitle = Object.fromEntries(imported.notes.map((n) => [n.title, n]));
  assert.ok(
    byTitle["회계"].body.startsWith(
      "<!-- xdocs:parent=" + byTitle["팀 자료"].id + " -->",
    ),
  );
  assert.ok(
    byTitle["결산"].body.startsWith(
      "<!-- xdocs:parent=" + byTitle["회계"].id + " -->",
    ),
  );
  assert.ok(
    byTitle["월별"].body.startsWith(
      "<!-- xdocs:parent=" + byTitle["팀 자료"].id + " -->",
    ),
  );
  const csv = dirPath => path.join(dirPath,"고객.csv");
  await writeFile(csv(temp),'업체,메모\r\n가나다,"서울, 본사"\r\n');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},csv(temp));
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button",{name:"Excel·CSV 시트 가져오기"}).click();
  const cell=page.getByRole("textbox",{name:"고객 B2",exact:true});
  await cell.waitFor();
  assert.equal(await cell.inputValue(),"서울, 본사");
  console.log(
    "PASS Electron sheet import: native picker, tabs, values, local save, source unchanged, protected file attached without extraction",
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  await rm(temp, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
