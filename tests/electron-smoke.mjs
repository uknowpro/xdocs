import { _electron as electron, expect } from "@playwright/test";
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
  args: process.env.XDOCS_EXECUTABLE ? [] : ["."],
  ...(process.env.XDOCS_EXECUTABLE
    ? { executablePath: process.env.XDOCS_EXECUTABLE }
    : {}),
  env: { ...process.env, XDOCS_TEST_DATA: data },
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "데스크톱 테스트" }).waitFor();
  await page.getByRole("button", { name: "편집하기" }).click();
  await page.getByRole("button",{name:"Markdown 원문",exact:true}).click();
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
  await page.locator(".page-row.current").getByRole("button", { name: "새 노트", exact: true }).waitFor();
  await page.getByRole("button",{name:"Markdown 원문",exact:true}).click();
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
  await page.getByRole("button", { name: "블록 편집", exact: true }).click();
  await page.getByRole("textbox", { name: "블록 편집기" }).waitFor();
  await page
    .getByRole("button", { name: "Markdown 원문", exact: true })
    .click();
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
  await page
    .getByRole("button", { name: "환경 설정", exact: true })
    .first()
    .click();
  if (process.platform === "win32") {
    await expect.poll(() => page.evaluate(() => navigator.windowControlsOverlay?.visible)).toBe(true);
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      const apply = window.setTitleBarOverlay.bind(window);
      window.setTitleBarOverlay = (colors) => {
        apply(colors);
        globalThis.testTitleBarColors = colors;
      };
    });
    const dialog = page.getByRole("dialog", { name: "환경 설정" });
    const selectTheme = name => dialog.getByRole("button", { name, exact: true }).click();
    const colors = () => app.evaluate(() => globalThis.testTitleBarColors);
    for (const [name, color, symbolColor] of [
      ["다크", "rgb(22, 22, 22)", "rgb(229, 229, 229)"],
      ["그레이", "rgb(232, 232, 232)", "rgb(41, 41, 41)"],
      ["화이트", "rgb(246, 246, 246)", "rgb(41, 41, 41)"],
    ]) {
      await selectTheme(name);
      await expect.poll(colors).toEqual({ color, symbolColor });
    }
    await selectTheme("시스템");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(colors).toEqual({ color: "rgb(22, 22, 22)", symbolColor: "rgb(229, 229, 229)" });
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(colors).toEqual({ color: "rgb(246, 246, 246)", symbolColor: "rgb(41, 41, 41)" });
    await selectTheme("화이트");
    await page.emulateMedia({ colorScheme: null });
    console.log("PASS Windows title bar follows the xdocs and system themes");
  }
  await page.getByRole("button", { name: "앱 정보", exact: true }).click();
  await page
    .getByRole("button", { name: "라이선스 정보", exact: true })
    .click();
  const license = page.getByRole("dialog", { name: "라이선스 정보" });
  for (const [label, text] of [
    ["현재 사용권 전문", "Internal Business Use"],
    ["helm / LICENSE", "Apache License"],
    ["kubewiser / LICENSE", "Copyright"],
    ["netspector / LICENSE", "Copyright"],
  ]) {
    await license.getByText(label, { exact: true }).click();
    await license
      .locator("details[open] pre")
      .filter({ hasText: text })
      .waitFor();
    await license.getByText(label, { exact: true }).click();
  }
  await page.getByRole("button", { name: "라이선스 정보 닫기" }).click();
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
