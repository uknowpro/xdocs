import { _electron, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { encodeWorkbook } from "../shared/tabular.mjs";
import {
  newArchitecture,
  newComponent,
  encodeArchitecture,
} from "../shared/architecture.mjs";
const root = await mkdtemp(path.join(tmpdir(), "xdocs-material-"));
const profile = path.join(root, "profile"),
  vault = path.join(root, "vault");
await mkdir(profile);
await mkdir(vault);
await writeFile(
  path.join(profile, "workspace.json"),
  JSON.stringify({ root: vault }),
);
const requests = [];
const server = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  requests.push({ body: JSON.parse(body), res });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const sheet = (value) =>
  "# 예산\n\n" +
  encodeWorkbook({
    version: 1,
    sheets: [
      {
        id: "s",
        name: "비용",
        firstRowHeader: true,
        rows: [
          ["private header", "금액"],
          ["OUTSIDE", value],
        ],
      },
    ],
  });
const model = newArchitecture(),
  chosen = newComponent("aws_vpc"),
  other = newComponent("aws_vpc");
model.nodes.push(chosen, other);
let app;
async function launch() {
  const exe = process.env.XDOCS_EXECUTABLE;
  app = await _electron.launch({
    args: exe ? [] : ["."],
    executablePath: exe || undefined,
    env: { ...process.env, XDOCS_TEST_DATA: profile },
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1 });
  });
  await expect(page.locator(".workspace-switch strong")).toHaveText("vault");
  return page;
}
try {
  let page = await launch();
  const session = {
    endpoint:
      "http://127.0.0.1:" + server.address().port + "/v1/chat/completions",
    model: "fixture",
    profile: "",
    harness: { name: "등록 구성", stages: ["original-stage"], skills: [] },
    turns: [],
  };
  const ids = await page.evaluate(
    async (bodies) =>
      Promise.all(
        bodies.map(
          async ([name, body]) => (await window.xdocs.create(name, body)).id,
        ),
      ),
    [
      ["예산", sheet("730")],
      ["망 설계", "# 망 설계\n\n" + encodeArchitecture(model)],
      ["정리", "# 정리\n\n원래 블록\n\n유지 블록\n"],
      [
        "검토 세션",
        "# 검토 세션\n\n```xdocs-xcode\n" + JSON.stringify(session) + "\n```",
      ],
    ],
  );
  await page.reload();
  const button = (name) => page.getByRole("button", { name, exact: true });
  let prompt = page.getByLabel("xcode 메시지");
  const open = () => button("검토 세션").first().click();
  const change = async (id, body) =>
    page.evaluate(
      async ({ id, body }) => {
        const n = await window.xdocs.readNote(id);
        await window.xdocs.save({ ...n, body });
      },
      { id, body },
    );
  const read = (id) => page.evaluate((id) => window.xdocs.readNote(id), id);
  const count = (n) => expect.poll(() => requests.length).toBe(n);
  const answer = (i, text) => {
    requests[i].res.writeHead(200, { "Content-Type": "text/event-stream" });
    requests[i].res.end(
      "data: " +
        JSON.stringify({ choices: [{ delta: { content: text } }] }) +
        "\n\ndata: [DONE]\n\n",
    );
  };
  await open();
  async function pick(id) {
    await prompt.fill("");
    await prompt.press("@");
    await page.getByLabel("워크스페이스 페이지").selectOption(id);
  }
  await pick(ids[0]);
  await page.getByLabel("첨부할 셀 범위").fill("B1:B2");
  await button("선택한 자료 첨부").click();
  await pick(ids[1]);
  await page.getByLabel("첨부할 리소스").selectOption(chosen.id);
  await button("선택한 자료 첨부").click();
  await pick(ids[2]);
  await button("선택한 자료 첨부").click();
  await prompt.fill("확인");
  await prompt.press("Enter");
  await count(1);
  const sent = JSON.stringify(requests[0].body.messages);
  for (const expected of ["730", chosen.id, "원래 블록"])
    assert.ok(sent.includes(expected), expected);
  for (const forbidden of ["OUTSIDE", other.id, "private header"])
    assert.ok(!sent.includes(forbidden), forbidden);
  answer(
    0,
    "결정 [예산#비용!B2]\n\n| 항목 | 값 |\n| --- | --- |\n| 예산 | 730 |\n\n```terraform\nresource example {}\n```",
  );
  await page.locator(".answer-source summary").click();
  const pane = page.getByRole("complementary", { name: "첨부 출처" });
  await expect(pane).toContainText("금액");
  await expect(pane.locator("[data-cited=true]")).toHaveText("730");
  await pane.getByText("원본 열기").click();
  await expect(page.locator(".sheet-grid td.selected textarea")).toHaveValue(
    "730",
  );
  await button("대화로 돌아가기").click();
  await page.getByLabel("답변 메뉴").click();
  await button("망 설계 원본 열기").click();
  await expect(page.getByLabel("컴포넌트 표시 이름")).toHaveValue(chosen.label);
  await button("대화로 돌아가기").click();
  await page.getByLabel("답변 메뉴").click();
  await button("기존 노트에 반영").click();
  await page.getByLabel("워크스페이스 페이지").selectOption(ids[2]);
  await page.getByLabel("반영 위치").selectOption("1");
  await expect(page.locator(".material-diff [data-kind=remove]")).toContainText(
    "원래 블록",
  );
  await change(ids[2], "# 정리\n\n경합 블록\n\n유지 블록\n");
  await button("변경 저장").click();
  await expect(page.locator(".material-dialog [role=alert]")).toContainText(
    "변경",
  );
  await button("다시 불러오기").click();
  await page.getByLabel("반영 위치").selectOption("1");
  await button("변경 저장").click();
  await expect.poll(async () => (await read(ids[2])).body).toContain("결정");
  assert.match((await read(ids[2])).body, /유지 블록/);
  const changed = await read(ids[2]);
  await change(ids[2], changed.body + "\n\n나중 작업\n");
  await page.getByLabel("답변 메뉴").click();
  await button("노트 반영 이력").click();
  await button("되돌리기 미리보기").click();
  await expect(page.locator(".material-dialog")).toContainText(
    "반영 후 원본이 수정되었습니다.",
  );
  await button("되돌리기 저장").click();
  await expect(page.locator(".material-dialog")).toContainText("되돌림");
  assert.match((await read(ids[2])).body, /경합 블록[\s\S]+나중 작업/);
  await button("닫기").click();

  const secondNote = await page.evaluate(
    async () =>
      (await window.xdocs.create("추가 노트", "# 추가 노트\n\n기본 내용")).id,
  );
  const answerParagraph = page.locator(".chat-answer p").first();
  await answerParagraph.evaluate((el) => {
    const range = document.createRange();
    range.setStart(el.firstChild, 0);
    range.setEnd(el.firstChild, 2);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await button("선택한 부분 반영").click();
  await page.getByLabel("워크스페이스 페이지").selectOption(ids[2]);
  await expect(page.getByLabel("반영할 내용")).toHaveValue("결정");
  await button("검토 목록에 추가").click();
  await page.getByLabel("워크스페이스 페이지").selectOption(secondNote);
  await page.getByLabel("반영할 내용").fill("별도 결정");
  await button("검토 목록에 추가").click();
  await page
    .locator(".application-proposal")
    .filter({ hasText: "추가 노트" })
    .locator("summary")
    .click();
  await page
    .locator(".application-proposal")
    .filter({ hasText: "추가 노트" })
    .getByLabel("이 변경 저장")
    .uncheck();
  await button("닫기").click();
  await app.close();
  page = await launch();
  prompt = page.getByLabel("xcode 메시지");
  await open();
  await button("노트 반영 초안 이어서 검토").click();
  const firstProposal = page
    .locator(".application-proposal")
    .filter({ hasText: "정리" });
  const secondProposal = page
    .locator(".application-proposal")
    .filter({ hasText: "추가 노트" });
  await secondProposal.locator("summary").click();
  await expect(secondProposal.getByLabel("이 변경 저장")).not.toBeChecked();
  const baseline = await read(ids[2]);
  await change(ids[2], baseline.body + "\n다른 곳 수정\n");
  await button("선택한 변경 저장").click();
  await expect(page.getByRole("region",{name:"노트 반영 결과"})).toContainText("충돌·오류 1건");
  await expect(firstProposal).toContainText("재검토 필요");
  await button("결과 닫기").click();
  await firstProposal.locator("summary").click();
  await firstProposal.getByText("최신본에서 재검토").click();
  await expect(page.getByText("검토 당시 원본과 최신본 비교")).toBeVisible();
  await button("검토 목록에 추가").click();
  await button("선택한 변경 저장").click();
  await expect.poll(async () => (await read(ids[2])).body).toMatch(/결정\n$/);
  assert.doesNotMatch((await read(secondNote)).body, /별도 결정/);
  await expect(page.getByRole("region",{name:"노트 반영 결과"})).toContainText("완료 1건");
  await expect(page.getByRole("region",{name:"노트 반영 결과"})).toContainText("보류 1건");
  await button("검토 초안 삭제").click();
  await button("정리").first().click();
  await page.getByText(/^반영 출처/).click();
  await button("검토 세션 · 답변 1").click();
  await expect(page.locator("article[data-turn='0']")).toBeFocused();
  await expect(page.locator(".applied-answer")).toContainText("결정");
  await expect(page.locator(".applied-answer")).toContainText("예산#비용!B2");
  await page.getByLabel("답변 메뉴").click();
  await button("노트 반영 이력").click();
  const exportPath=path.join(root,"note-review.md");
  await app.evaluate(({BrowserWindow},dest)=>{
    BrowserWindow.getAllWindows()[0].webContents.session.once("will-download",(_event,item)=>item.setSavePath(dest));
  },exportPath);
  await button("검토 기록 Markdown 저장").click();
  await expect.poll(()=>readFile(exportPath,"utf8").catch(()=>"")).toContain("예산#비용!B2");
  await button("닫기").click();
  await page.getByLabel("답변 메뉴").click();
  await button("답변 블록 선택").click();
  const picker = page.locator(".answer-block-picker");
  await picker.getByRole("checkbox").nth(1).check();
  await picker.getByRole("checkbox").nth(2).check();
  await button("선택 블록 반영").click();
  await page.getByLabel("워크스페이스 페이지").selectOption(secondNote);
  await expect(page.getByLabel("반영할 내용")).toHaveValue(
    /\| 항목 \| 값 \|[\s\S]+```terraform/,
  );
  await button("변경 저장").click();
  await expect
    .poll(async () => (await read(secondNote)).body)
    .toContain("```terraform");
  await change(ids[0], sheet("880"));
  await page
    .locator("button.material-origin")
    .filter({ hasText: "예산" })
    .click();
  await expect(page.locator(".material-diff")).toContainText("880");
  await button("최신 사본 사용").click();
  await prompt.fill("다시 확인");
  await prompt.press("Enter");
  await count(2);
  assert.ok(JSON.stringify(requests[1].body.messages).includes("880"));
  assert.ok(!JSON.stringify(requests[1].body.messages).includes("B2=730"));
  for (const text of ["고정", "동적"]) {
    await prompt.fill(text);
    await prompt.press("Enter");
  }
  await page.locator(".chat-waiting > summary").click();
  const config = page.locator(".queue-harness").last();
  await config.locator("summary").click();
  await config.locator("select").selectOption("current");
  requests[1].res.writeHead(429);
  requests[1].res.end("quota");
  await button("건너뛰고 다음 전송").waitFor();
  const saved = await read(ids[3]);
  await change(ids[3], saved.body.replaceAll("original-stage", "new-stage"));
  await page.reload();
  await open();
  await button("건너뛰고 다음 전송").click();
  await count(3);
  assert.match(requests[2].body.messages[0].content, /original-stage/);
  answer(2, "고정 완료");
  await count(4);
  assert.match(requests[3].body.messages[0].content, /new-stage/);
  answer(3, "동적 완료");
  await expect(page.locator(".chat-answer").last()).toContainText("동적 완료");
  console.log(
    "PASS scoped attachments, citation context, conflicting note edits, snapshot refresh and queued harness policies",
  );
} finally {
  if (app) await app.close().catch(() => {});
  server.closeAllConnections();
  server.close();
  await rm(root, {
    recursive: true,
    force: true,
    maxRetries: 4,
    retryDelay: 120,
  });
}
