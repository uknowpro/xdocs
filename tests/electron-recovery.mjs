import { _electron, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const root = await mkdtemp(path.join(tmpdir(), "xdocs-recovery-")),
  data = path.join(root, "data"),
  vault = path.join(root, "workspace");
await mkdir(data);
await mkdir(vault);
await writeFile(
  path.join(data, "workspace.json"),
  JSON.stringify({ root: vault }),
);
const calls = [];
const server = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  calls.push(JSON.parse(body));
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  res.write(
    "data: " +
      JSON.stringify({
        choices: [
          {
            delta: {
              content:
                calls.length === 2 ? "partial" : "answer-" + calls.length,
            },
          },
        ],
      }) +
      "\n\n",
  );
  if (calls.length !== 2) res.end("data: [DONE]\n\n");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let app;
async function launch() {
  app = await _electron.launch({
    args: [
      ...(process.env.XDOCS_EXECUTABLE ? [] : ["."]),
      "--user-data-dir=" + data,
    ],
    ...(process.env.XDOCS_EXECUTABLE
      ? { executablePath: path.resolve(process.env.XDOCS_EXECUTABLE) }
      : {}),
    env: { ...process.env, XDOCS_TEST_DATA: data },
  });
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1 });
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  return page;
}
try {
  let page = await launch();
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "xcode 세션 만들기" }).click();
  await page.getByLabel("xcode 메시지").fill("전송 전 초안");
  await app.close();
  page = await launch();
  if (!await page.locator(".xcode").count())
    await page.getByRole("button",{name:"새 xcode 세션",exact:true}).first().click();
  await expect(page.getByLabel("xcode 메시지")).toHaveValue("전송 전 초안");
  await page.getByRole("button",{name:"세션 설정 펼치기"}).click();
  await page
    .getByLabel("API 주소")
    .fill("http://127.0.0.1:" + server.address().port + "/v1/chat/completions");
  await page.getByRole("button", { name: "하네스·스킬", exact: true }).click();
  await page.getByLabel("템플릿 적용").selectOption("코드 검토");
  await page.getByRole("button",{name:"전체 단계 적용"}).click();
  await page.getByRole("button",{name:"설정 저장",exact:true}).click();
  await expect(page.getByRole("dialog", { name: "세션 설정" })).toBeHidden();
  await page.getByLabel("xcode 메시지").fill("recover this run");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => calls.length).toBe(2);
  await expect(page.locator(".xcode .chat-live pre")).toContainText("partial");
  const child = app.process();
  const exited = once(child, "exit");
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
  } else {
    child.kill("SIGKILL");
  }
  await exited;
  page = await launch();
  await page.getByRole("button", { name: "새로 만들기", exact: true }).waitFor();
  if (!(await page.locator(".xcode").count()))
    await page
      .getByRole("button", { name: "새 xcode 세션", exact: true })
      .first()
      .click();
  await page.getByRole("button", { name: "미완료 단계부터 재실행" }).click();
  await expect(page.locator(".xcode article")).toContainText("answer-3");
  await expect(page.getByLabel("xcode 메시지")).toHaveValue("");
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith("xdocs.xcode.draft.")).length),0);
  assert.equal(calls.length, 3);
  assert.ok(
    calls[2].messages.some(
      (m) => m.role === "assistant" && m.content === "answer-1",
    ),
  );
  await expect(
    page.getByRole("button", { name: "미완료 단계부터 재실행" }),
  ).toHaveCount(0);
  console.log(
    "PASS recovery after process kill: completed stage preserved, one missing stage rerun",
  );
} finally {
  if (app) await app.close().catch(() => {});
  server.closeAllConnections();
  server.close();
  await rm(root, {
    recursive: true,
    force: true,
    maxRetries: 6,
    retryDelay: 150,
  });
}
