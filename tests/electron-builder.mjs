import { _electron } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
const dir = await mkdtemp(path.join(os.tmpdir(), "xdocs-builder-native-"));
const vault = path.join(dir, "vault"),
  data = path.join(dir, "data");
await Promise.all([mkdir(vault), mkdir(data)]);
await writeFile(
  path.join(data, "workspace.json"),
  JSON.stringify({ root: vault }),
);
await writeFile(
  path.join(vault, "cost.md"),
  "# 비용 정산\n\n```xdocs-sheets\n" +
    JSON.stringify({
      version: 1,
      sheets: [{ id: "cost", name: "비용", rows: [["금액"], ["1300"]] }],
    }) +
    "\n```\n",
);
const requests = [];
const server = createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const body = JSON.parse(text);
  requests.push({
    model: body.model,
    prompt: body.messages[0].content,
    key: req.headers.authorization,
  });
  if (body.model === "primary") {
    res.writeHead(503);
    res.end();
    return;
  }
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "검토 완료",
              evidence: ["비용!A2"],
            }),
          },
        },
      ],
    }),
  );
}).listen(0, "127.0.0.1");
let app;
try {
  await once(server, "listening");
  app = await _electron.launch({
    args: ["."],
    env: { ...process.env, XDOCS_TEST_DATA: data },
  });
  const p = await app.firstWindow();
  await p.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await p.getByRole("button", { name: "Builder 만들기" }).click();
  await p
    .getByLabel("시트 페이지", { exact: true })
    .selectOption({ label: "비용 정산" });
  await p.getByText("연결한 모델로 초안 작성", { exact: true }).click();
  await p
    .getByRole("textbox", { name: "Chat Completions 주소" })
    .fill("http://127.0.0.1:" + server.address().port + "/v1/chat/completions");
  await p
    .getByRole("textbox", { name: "모델 이름", exact: true })
    .fill("backup");
  await p.getByLabel("프로필 이름", { exact: true }).fill("backup");
  await p.getByRole("button", { name: "프로필 저장 · 같은 이름 교체" }).click();
  await p
    .getByLabel("저장된 모델 프로필")
    .getByRole("option", { name: "backup", exact: true })
    .waitFor({ state: "attached" });
  await p
    .getByRole("textbox", { name: "모델 이름", exact: true })
    .fill("primary");
  await p.getByLabel("API 키", { exact: true }).fill("primary-only");
  await p.getByLabel("응답 형식").selectOption("evidence-json");
  await p.getByRole("button", { name: "모델로 전송", exact: true }).click();
  await p.getByRole("button", { name: "같은 모델로 재시도" }).click();
  await p.getByLabel("대체 모델 프로필").selectOption("backup");
  await p.getByRole("button", { name: "대체 모델로 전송" }).click();
  await p
    .getByText("근거 검토 · 누락 0건 · 입력에 없는 주소 0건", { exact: true })
    .waitFor();
  assert.deepEqual(
    requests.map((r) => r.model),
    ["primary", "primary", "backup"],
  );
  assert.equal(requests[2].key, undefined);
  assert.equal(new Set(requests.map((r) => r.prompt)).size, 1);
  await p.getByRole("button", { name: "결과를 하위 노트로 저장" }).click();
  await p
    .locator(".markdown")
    .getByText(/검토 완료/)
    .first()
    .waitFor();
  const w = await p.evaluate(() => window.xdocs.refresh());
  const n = w.notes.find((n) => n.title === "업무 검토 결과");
  assert.ok(n);
  assert.equal(
    w.notes.filter((note) => note.title === "업무 검토 결과").length,
    1,
  );
  assert.match(await readFile(path.join(vault, n.path), "utf8"), /검토 완료/);
  console.log(
    "PASS Electron Builder: native SQLite workspace, compatible HTTP endpoint, evidence and saved child note",
  );
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0));
  server.close();
  await rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 4,
    retryDelay: 200,
  });
}
