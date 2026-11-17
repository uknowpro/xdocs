import { _electron as electron } from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const temp = await mkdtemp(path.join(os.tmpdir(), "xdocs-electron-"));
const data = path.join(temp, "app-data"),
  vault = path.join(temp, "vault");
await mkdir(data);
await mkdir(vault);
await writeFile(
  path.join(data, "workspace.json"),
  JSON.stringify({ root: vault }),
);
await writeFile(
  path.join(vault, "start.md"),
  "# 데스크톱 테스트\n\n실제 파일과 SQLite 검증",
);
const app = await electron.launch({
  args: ["."],
  env: { ...process.env, XDOCS_TEST_DATA: data },
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "데스크톱 테스트" }).waitFor();
  await page.getByRole("button", { name: "편집하기" }).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# 데스크톱 테스트\n\n한글 저장 완료");
  await page.waitForFunction(() =>
    document
      .querySelector(".save-state")
      ?.textContent?.includes("로컬에 저장됨"),
  );
  assert.match(
    await readFile(path.join(vault, "start.md"), "utf8"),
    /한글 저장 완료/,
  );
  const index = await readFile(path.join(vault, ".xdocs", "index.sqlite"));
  assert.equal(index.subarray(0, 15).toString(), "SQLite format 3");
  await page.getByRole("button", { name: "새 노트", exact: true }).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# 두 번째 노트\n\n[[데스크톱 테스트]]");
  await page.waitForFunction(() =>
    document
      .querySelector(".save-state")
      ?.textContent?.includes("로컬에 저장됨"),
  );
  assert.equal(
    (await readdir(vault)).filter((n) => n.endsWith(".md")).length,
    2,
  );
  await page.getByRole("button", { name: "읽기 모드" }).click();
  for (const format of ["md", "html", "pdf"]) {
    const output = path.join(temp, "export." + format);
    await app.evaluate(({ dialog }, output) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: output,
      });
    }, output);
    await page.getByRole("button", { name: "내보내기", exact: true }).click();
    await page
      .locator(".dropdown")
      .getByRole("button", {
        name: format === "md" ? "Markdown" : format.toUpperCase(),
        exact: true,
      })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "내보내기를 완료" })
      .waitFor();
    const bytes = await readFile(output);
    if (format === "pdf") assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    else assert.match(bytes.toString(), /두 번째 노트/);
    // Clear the previous notification so each export waits for its own completion.
    await page.waitForFunction(() => !document.querySelector(".toast"));
  }
  await page.screenshot({ path: "test-results/electron-desktop.png" });
  console.log(
    "PASS Electron: real file save, SQLite header, new note, Markdown/HTML/PDF export",
  );
} finally {
  const closed = new Promise((resolve) => app.once("close", resolve));
  await app.evaluate(({ app }) => app.exit(0));
  await closed;
  await rm(temp, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
