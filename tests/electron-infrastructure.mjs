import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const temp = await mkdtemp(path.join(os.tmpdir(), "xdocs-infra-")),
  data = path.join(temp, "app"),
  vault = path.join(temp, "vault"),
  file = path.join(temp, "compose.yaml");
await mkdir(data);
await mkdir(vault);
await writeFile(
  path.join(data, "workspace.json"),
  JSON.stringify({ root: vault }),
);
const source =
  "services:\n  web:\n    depends_on: [db]\n    environment: {PASSWORD: SECRET_VALUE}\n  db:\n    deploy: {replicas: 2}\n";
await writeFile(file, source);
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
  await page.getByRole("button", { name: "인프라 문서", exact: true }).click();
  await page.getByRole("button", { name: "파일 선택", exact: true }).click();
  await page.getByRole("button", { name: "인프라 노트 생성" }).click();
  await expect(
    page.getByRole("heading", { name: "Docker Compose", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("cell", { name: "service:web", exact: true })
    .getByRole("button")
    .click();
  await page
    .getByRole("textbox", { name: "리소스 운영 메모" })
    .fill("담당: 플랫폼팀");
  await expect(page.locator(".save-state")).toContainText("로컬에 저장됨");
  const w = await page.evaluate(() => window.xdocs.refresh());
  const id = w.notes.find((n) => n.title.startsWith("인프라")).id;
  const full = await page.evaluate((id) => window.xdocs.readNote(id), id);
  assert.doesNotMatch(full.body, /SECRET_VALUE/);
  assert.match(full.body, /플랫폼팀/);
  assert.equal(await readFile(file, "utf8"), source);
  await writeFile(
    file,
    source.replace("replicas: 2", "replicas: 3") + "  worker: {}\n",
  );
  await page.getByRole("button", { name: "다시 가져와 비교" }).click();
  await expect(
    page.getByRole("region", { name: "인프라 변경 비교" }),
  ).toContainText("1개 추가 · 1개 변경 · 0개 제거");
  await page.getByRole("button", { name: "새 스냅샷 적용" }).click();
  await expect(
    page.getByRole("textbox", { name: "리소스 운영 메모" }),
  ).toHaveValue("담당: 플랫폼팀");
  await expect(page.locator(".save-state")).toContainText("로컬에 저장됨");
  await page.getByRole("tab", { name: "관계", exact: true }).click();
  await expect(page.getByLabel("리소스 관계 그래프")).toBeVisible();
  const originalFile = page.getByRole("tab",{name:"원문",exact:true});
  await originalFile.click();
  await page.getByLabel("로컬 원문 열기").setInputFiles(file);
  const sourceView=page.getByLabel("인프라 파일 원문");
  await expect(sourceView).toHaveValue(/depends_on/);
  await sourceView.focus();
  await sourceView.evaluate(el=>el.setSelectionRange(2,7));
  await page.getByRole("tab",{name:"관계",exact:true}).click();
  await originalFile.click();
  assert.deepEqual(await sourceView.evaluate(el=>[el.selectionStart,el.selectionEnd]),[2,7]);
  await page.getByRole("tab",{name:"관계",exact:true}).click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: "test-results/infrastructure.png" });
  const output = path.join(temp, "infra.html");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, output);
  await page.evaluate((id) => window.xdocs.export({ id, format: "html" }), id);
  const html = await readFile(output, "utf8");
  assert.match(html, /service:web/);
  assert.doesNotMatch(html, /xdocs-infra|SECRET_VALUE/);
  await page.getByRole("button", { name: "운영 절차 노트 만들기" }).click();
  await expect(
    page.getByRole("heading", { name: "운영 절차 · service:web", exact: true }),
  ).toBeVisible();
  const latest = await page.evaluate(() => window.xdocs.refresh());
  assert.equal(latest.notes.length, w.notes.length + 1);
  console.log(
    "PASS infrastructure: native file import, secret omission, snapshot comparison, retained memo, relationships, HTML export, linked runbook",
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
