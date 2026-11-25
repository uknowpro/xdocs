import { _electron as electron, chromium } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const temp = await mkdtemp(path.join(os.tmpdir(), "xdocs-features-")),
  data = path.join(temp, "data"),
  vault = path.join(temp, "vault");
await mkdir(data);
await mkdir(vault);
await writeFile(
  path.join(data, "workspace.json"),
  JSON.stringify({ root: vault }),
);
await writeFile(path.join(vault, "original.md"), "# 원본\n\n처음 내용");
const app = await electron.launch({
  args: ["."],
  env: { ...process.env, XDOCS_TEST_DATA: data },
});
let browser;
try {
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "원본", exact: true }).waitFor();
  await writeFile(
    path.join(vault, "original.md"),
    "# 외부 변경\n\n감지된 내용",
  );
  await page.getByRole("heading", { name: "외부 변경", exact: true }).waitFor();
  await page.getByRole("button", { name: "편집하기", exact: true }).click();
  await page.getByRole("button",{name:"Markdown 원문",exact:true}).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# 외부 변경\n\n수정한 내용");
  await page.waitForFunction(() =>
    document
      .querySelector(".save-state")
      ?.textContent?.includes("로컬에 저장됨"),
  );
  await page.getByRole("button", { name: "변경 이력", exact: true }).click();
  await page.getByRole("button", { name: "복원", exact: true }).first().click();
  await page.getByRole("button", { name: "읽기 모드", exact: true }).click();
  await page
    .locator(".markdown")
    .getByText("감지된 내용", { exact: true })
    .waitFor();
  const imported = path.join(temp, "import.html");
  await writeFile(
    imported,
    "<h1>HTML 가져오기</h1><p>정제된 내용</p><script>alert(1)</script>",
  );
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, imported);
  await page.getByRole("button", { name: "환경 설정", exact: true }).click();
  await page.getByRole("navigation", { name: "환경 설정 항목" }).getByRole("button", { name: "워크스페이스", exact: true }).click();
  await page
    .getByRole("button", { name: "Markdown / HTML 가져오기", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "HTML 가져오기", exact: true })
    .waitFor();
  assert.equal(await page.locator(".markdown script").count(), 0);
  await page.evaluate(() => {
    window.confirm = () => true;
  });
  await page.locator(".page-row.current").getByRole("button",{name:/페이지 메뉴$/}).click();
  await page.getByRole("button",{name:"휴지통으로 이동",exact:true}).click();
  await page.getByRole("button", { name: "휴지통", exact: true }).click();
  await page.getByRole("button", { name: "복원", exact: true }).first().click();
  await page
    .getByRole("heading", { name: "HTML 가져오기", exact: true })
    .waitFor();
  const pdf = path.join(temp, "sample.pdf");
  await writeFile(pdf, "%PDF-1.4\n");
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, pdf);
  await page.getByRole("button", { name: "첨부", exact: true }).click();
  await page
    .getByRole("button", { name: "PDF 문서 열기", exact: true })
    .waitFor();
  // Prevent real browser/keychain side effects while exercising the production login IPC.
  await app.evaluate(({ shell, safeStorage }) => {
    shell.openExternal = async (url) => {
      globalThis.__xdocsAuthURL = url;
    };
    safeStorage.isEncryptionAvailable = () => false;
  });
  await page.getByRole("button", { name: "워크스페이스 전환", exact: true }).click();
  await page
    .getByRole("button", { name: "조직 보관함 SSO", exact: true })
    .click();
  await page
    .getByRole("button", { name: "브라우저에서 SSO 로그인", exact: true })
    .click();
  let authURL;
  for (let i = 0; i < 100; i++) {
    authURL = await app.evaluate(() => globalThis.__xdocsAuthURL);
    if (authURL) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(authURL);
  browser = await chromium.launch();
  const auth = await browser.newPage();
  await auth.goto(authURL);
  await auth.locator("#username").fill("developer");
  await auth.locator("#password").fill("local-development-only");
  await auth.locator("#kc-login").click();
  await page.getByRole("button", { name: "열기", exact: true }).first().click();
  await page.getByRole("button", { name: "새 노트", exact: true }).click();
  await page.getByRole("button",{name:"Markdown 원문",exact:true}).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# Electron 조직 테스트\n\n공유 문서 저장");
  await page.waitForFunction(() =>
    document
      .querySelector(".save-state")
      ?.textContent?.includes("이 기기에 저장됨"),
  );
  await page.getByRole("button", { name: "워크스페이스 전환", exact: true }).click();
  await page
    .getByRole("button", { name: "보관함 새로고침", exact: true })
    .click();
  await page.getByRole("button", { name: "읽기 모드", exact: true }).click();
  await page
    .getByRole("heading", { name: "Electron 조직 테스트", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "공동 편집", exact: true }).click();
  await page
    .getByRole("textbox", { name: "공동 편집 블록 2" })
    .fill("동시 편집 내용");
  await page
    .getByRole("status")
    .filter({ hasText: "서버와 동기화됨" })
    .waitFor();
  await page
    .getByRole("dialog", { name: "실시간 공동 편집" })
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await page
    .locator(".markdown")
    .getByText("동시 편집 내용", { exact: true })
    .waitFor();
  await page.locator(".page-row.current").getByRole("button",{name:/페이지 메뉴$/}).click();
  await page.getByRole("button",{name:"휴지통으로 이동",exact:true}).click();
  await page.getByRole("button", { name: "워크스페이스 전환", exact: true }).click();
  await page
    .getByRole("button", { name: "보관함 새로고침", exact: true })
    .click();
  assert.match(
    await readFile(path.join(vault, "original.md"), "utf8"),
    /감지된 내용/,
  );
  console.log(
    "PASS Electron features: external watcher, history, HTML sanitization, trash restore, PDF attachment, real OIDC UI, server workspace save, local data isolation",
  );
} finally {
  await browser?.close();
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
