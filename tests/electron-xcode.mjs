import { zipSync, strToU8 } from "fflate";
import { _electron, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const root = await mkdtemp(path.join(tmpdir(), "xdocs-xcode-"));
const vault = path.join(root, "vault"),
  data = path.join(root, "data"),
  skill = path.join(vault, ".claude/skills/review");
await mkdir(skill, { recursive: true });
await mkdir(data);
await writeFile(
  path.join(skill, "SKILL.md"),
  "---\nname: evidence\ndescription: cites files\n---\nCite source filenames.",
);
await writeFile(
  path.join(data, "workspace.json"),
  JSON.stringify({ root: vault }),
);
const calls = [];
let lastAuthorization;
let slowResponse,
  caseMode = "normal",
  retryCalls = 0;
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const packet = JSON.parse(Buffer.concat(chunks));
  calls.push(packet);
  lastAuthorization = req.headers.authorization;
  if (caseMode === "hold") {
    slowResponse = res;
    return;
  }
  if (
    caseMode === "quota" ||
    caseMode === "429" ||
    (caseMode === "temporary" && retryCalls++ === 0)
  ) {
    res.writeHead(caseMode === "429" ? 429 : 503);
    res.end(
      caseMode === "quota"
        ? "usage_limit_exceeded"
        : caseMode === "429"
          ? "Too Many Requests"
          : "Unavailable",
    );
    return;
  }
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.write(": ping\r\n\r\n");
  const bytes = Buffer.from(
    "data: " +
      JSON.stringify({ choices: [{ delta: { content: "검토 결과 " } }] }) +
      "\r\n\r\n",
  );
  const split = bytes.indexOf(Buffer.from("검")) + 1;
  res.write(bytes.subarray(0, split));
  await new Promise((r) => setTimeout(r, 15));
  res.write(bytes.subarray(split));
  if (JSON.stringify(packet.messages).includes("wait-for-cancel")) return;
  res.end(
    "data: " +
      JSON.stringify({ choices: [{ delta: { content: "complete" } }] }) +
      "\n\ndata: [DONE]\n\n",
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const endpoint =
  "http://127.0.0.1:" + server.address().port + "/v1/chat/completions";
let app;
try {
  app = await _electron.launch({
    args: process.env.XDOCS_EXECUTABLE ? [] : ["."],
    ...(process.env.XDOCS_EXECUTABLE
      ? { executablePath: path.resolve(process.env.XDOCS_EXECUTABLE) }
      : {}),
    env: { ...process.env, XDOCS_TEST_DATA: data },
  });
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async (_window, options) => {
      if (options.message !== "이 서버로 세션 내용을 전송할까요?")
        throw Error("Unexpected dialog");
      return { response: 1 };
    };
  });
  const page = await app.firstWindow();
  await assert.rejects(
    page.evaluate(
      (endpoint) =>
        window.xdocs.xcodeChat({
          id: "unapproved",
          endpoint,
          model: "test",
          messages: [{ role: "user", content: "test" }],
        }),
      endpoint,
    ),
    /주소를 먼저 확인/,
  );
  assert.equal(calls.length, 0);
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "xcode 세션 만들기" }).click();
  await page.getByRole("button", { name: "세션 설정 펼치기" }).click();
  await page.getByLabel("API 주소").fill(endpoint);
  await expect(page.getByLabel("API 토큰 (선택)")).toBeVisible();
  await expect(page.getByLabel("모델명", { exact: true })).toBeVisible();
  await expect(page.getByLabel("재요청 간격(초)")).toBeHidden();
  const openAdvanced = async () => {
    const panel = page.locator(".chat-advanced");
    if (!(await panel.evaluate((el) => el.open)))
      await panel.locator(":scope > summary").click();
  };
  await page.getByText("JSON 설정", { exact: true }).click();
  const editor = page.getByLabel("설정 JSON", { exact: true });
  const applyJson = page.getByRole("button", { name: "JSON 적용" });
  await editor.fill(
    JSON.stringify({ endpoint, model: "invalid-change", retrySeconds: 0 }),
  );
  await applyJson.click();
  await expect(page.locator(".chat-json [role=alert]")).toContainText(
    "retrySeconds",
  );
  await expect(page.getByLabel("모델명", { exact: true })).not.toHaveValue(
    "invalid-change",
  );
  await page.getByLabel("설정 파일 불러오기").setInputFiles({
    name: "settings.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        endpoint,
        model: "test-chat",
        token: "fixture-local-key",
        retrySeconds: 45,
      }),
    ),
  });
  await expect(editor).toHaveValue(/test-chat/);
  await applyJson.click();
  await expect(page.getByLabel("모델명", { exact: true })).toHaveValue(
    "test-chat",
  );
  await expect(page.getByLabel("API 토큰 (선택)")).toHaveValue(
    "fixture-local-key",
  );
  await expect(editor).not.toHaveValue(/fixture-local-key/);
  await page.getByText("JSON 설정", { exact: true }).click();
  await openAdvanced();
  await expect(page.getByLabel("재요청 간격(초)")).toHaveValue("45");
  const addressField = page.getByLabel("API 주소");
  const tokenField = page.getByLabel("API 토큰 (선택)");
  await addressField.fill("");
  await addressField.fill(endpoint + "/alternative");
  await expect(tokenField).toHaveValue("fixture-local-key");
  await expect(page.getByRole("button",{name:/에서 이 토큰 사용/})).toHaveCount(0);
  await addressField.fill("https://example.invalid/v1/chat/completions");
  await expect(tokenField).toHaveValue("fixture-local-key");
  await page.getByRole("button",{name:"연결 진단 실행"}).click();
  await expect(page.getByText("변경한 서버에서 입력한 토큰을 사용할지 선택하세요.",{exact:true})).toBeVisible();
  assert.equal(calls.length,0);
  await page.getByRole("button",{name:"https://example.invalid에서 이 토큰 사용"}).click();
  await addressField.fill(endpoint);
  await page.getByRole("button",{name:new URL(endpoint).origin+"에서 이 토큰 사용"}).click();
  const canStore = await app.evaluate(({safeStorage}) => safeStorage.isEncryptionAvailable() &&
    !(process.platform === "linux" && safeStorage.getSelectedStorageBackend?.() === "basic_text"));
  await page.getByRole("button",{name:"이 기기에 토큰 저장"}).click();
  if (canStore) {
    await expect(tokenField).toHaveValue("");
    await expect(tokenField).toHaveAttribute("placeholder","이 기기에 저장된 토큰 사용");
    await addressField.fill(endpoint + "/changed");
    await expect(tokenField).not.toHaveAttribute("placeholder","이 기기에 저장된 토큰 사용");
    await addressField.fill(endpoint);
    await expect(tokenField).toHaveAttribute("placeholder","이 기기에 저장된 토큰 사용");
  } else {
    await expect(page.getByText(/운영체제 암호화 저장소와 API 키가 필요합니다/)).toBeVisible();
    await expect(tokenField).toHaveValue("fixture-local-key");
  }
  for (const kind of ["text", "image", "pdf"]) {
    await page.getByLabel("연결 진단 입력").selectOption(kind);
    await page.getByRole("button", { name: "연결 진단 실행" }).click();
    await expect(page.locator(".xcode [role=status]")).toContainText(
      "SSE 텍스트 응답",
    );
    assert.equal(lastAuthorization,"Bearer fixture-local-key");
    const packet = calls.pop();
    assert.equal(packet.messages.length, 1);
    if (kind !== "text")
      assert.ok(
        JSON.stringify(packet).includes(
          kind === "pdf"
            ? "data:application/pdf;base64,"
            : "data:image/png;base64,",
        ),
      );
  }
  await page.getByText("하네스 구성 · DeepSeek · 근거 기반 답변").click();
  await expect(page.getByLabel("직무 역할", { exact: true })).toHaveValue("");
  await page.getByLabel("직무 역할", { exact: true }).selectOption("백엔드 엔지니어");
  await page
    .getByLabel("템플릿 적용")
    .selectOption("DeepSeek · 시각 자료 판독");
  await page.getByRole("button",{name:"전체 단계 적용"}).click();
  await page.getByLabel("추론 강도").selectOption("high");
  await page.getByRole("button", { name: ".claude 스킬 찾기" }).click();
  await page
    .getByRole("button", { name: "워크스페이스 · evidence 추가" })
    .click();
  await page
    .locator(".xcode input[type=file][multiple]:not([webkitdirectory])")
    .setInputFiles([
      {
        name: "omit.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("omitted-marker"),
      },
      {
        name: "hello.py",
        mimeType: "text/plain",
        buffer: Buffer.from("print(42)"),
      },
      ...[
        ["memo.hwpx", "Contents/section0.xml", "<s><p><t>HWPX evidence</t></p></s>"],
        ...["odt", "ott", "odp", "otp"].map(ext => [
          "sample." + ext, "content.xml",
          '<root xmlns:t="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><t:p>' + ext + '<t:s/>evidence</t:p></root>',
        ]),
        ["letter.dotx", "word/document.xml", "<p><t>DOTX evidence</t></p>"],
        ["deck.potx", "ppt/slides/slide1.xml", "<p><t>POTX evidence</t></p>"],
        ["budget.xltx", "xl/worksheets/sheet1.xml", '<sheet><row><c r="B4"><v>123</v></c></row></sheet>'],
        [
          "brief.docx",
          "word/document.xml",
          "<root><p><t>Document evidence</t></p></root>",
        ],
        [
          "slides.pptx",
          "ppt/slides/slide1.xml",
          "<root><p><t>Slide evidence</t></p></root>",
        ],
        [
          "book.xlsx",
          "xl/worksheets/sheet1.xml",
          '<worksheet><row><c r="A1"><v>42</v></c></row></worksheet>',
        ],
      ].map(([name, part, xml]) => ({
        name,
        mimeType: "application/octet-stream",
        buffer: Buffer.from(zipSync({ [part]: strToU8(xml) })),
      })),
      {
        name: "brief.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4"),
      },
      {
        name: "diagram.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6V8AAAAASUVORK5CYII=",
          "base64",
        ),
      },
    ]);
  await page.getByRole("button", { name: "diagram.png 제거" }).waitFor();
  const wordId = crypto.randomUUID();
  const requestFile = path.join(root,wordId+".xdocs-word.json");
  const helperFile = path.join(root,"xdocs-word.ps1");
  await writeFile(requestFile,JSON.stringify({version:1,id:wordId,name:"업무 보고서.docx",text:"선택한 원문 문장",expires:Date.now()+1800000}));
  await app.evaluate(({dialog},{requestFile,helperFile})=>{
    dialog.showOpenDialog = async()=>({canceled:false,filePaths:[requestFile]});
    dialog.showSaveDialog = async()=>({canceled:false,filePath:helperFile});
  },{requestFile,helperFile});
  await expect(page.locator(".word-selection")).toBeHidden();
  await page.getByRole("button",{name:"파일 첨부",exact:true}).click();
  await page.getByRole("button",{name:"Word 선택 영역",exact:true}).click();
  await page.getByRole("button",{name:"Windows 도우미 저장"}).click();
  await expect(page.locator(".word-selection [role=status]")).toContainText("저장했습니다");
  assert.match(await readFile(helperFile,"utf8"),/Word\.Application/);
  await page.getByRole("button",{name:"Word 선택 영역 가져오기"}).click();
  await expect(page.locator(".word-selection [role=status]")).toContainText("첨부했습니다");
  await page.getByText("전송 미리보기", { exact: true }).click();
  await page.getByLabel("새 첨부 · omit.txt").uncheck();
  const composer = page.getByLabel("xcode 메시지");
  await composer.fill("Review");
  await composer.press("Shift+Enter");
  await expect(composer).toHaveValue("Review\n");
  await composer.fill("Review this.");
  await composer.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  assert.equal(calls.length, 0);
  await composer.press("Enter");
  await expect(page.locator(".chat-question").first()).toContainText(
    "Review this.",
  );
  await expect(page.locator(".xcode article").first()).toContainText(
    "검토 결과 complete",
  );
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => !JSON.stringify(c).includes("omitted-marker")));
  assert.equal(calls[0].reasoning_effort, "low");
  assert.equal(calls[1].reasoning_effort, "high");
  assert.deepEqual(
    calls[1].messages.slice(0, calls[0].messages.length),
    calls[0].messages,
  );
  for (const packet of calls.slice(0, 2)) assert.match(packet.messages[0].content, /직무 역할: 백엔드 엔지니어/);
  assert.match(calls[0].messages[0].content, /Cite source filenames/);
  assert.match(JSON.stringify(calls[0].messages), /print\(42\)/);
  assert.match(JSON.stringify(calls[0].messages), /data:image\/png;base64,/);
  for (const expected of [
    "Document evidence",
    "Slide evidence",
    "HWPX evidence", "odt evidence", "ott evidence", "odp evidence", "otp evidence",
    "DOTX evidence", "POTX evidence", "B4=123",
    "A1=42",
    "data:application/pdf;base64,",
  ])
    assert.ok(JSON.stringify(calls[0].messages).includes(expected), expected);
  assert.match(JSON.stringify(calls[1].messages), /검토 결과 complete/);
  await expect(page.locator(".save-state")).toContainText("로컬에 저장됨");
  const note = await page.evaluate(async () => {
    const w = await window.xdocs.refresh();
    return window.xdocs.readNote(
      w.notes.find((n) => n.title.includes("xcode")).id,
    );
  });
  assert.match(note.body, /diagram.png/);
  assert.ok(!note.body.includes("fixture-local-key"));
  const stored = JSON.parse(note.body.match(/```xdocs-xcode\s+(.+)\s+```/)[1])
    .turns[0];
  assert.deepEqual(stored.execution.skills, ["evidence"]);
  assert.equal(stored.answers[0].effort, "low");
  assert.equal(stored.answers[0].retries, 0);
  assert.ok(stored.execution.model);
  assert.doesNotMatch(note.body, /iVBORw0/);
  assert.match(JSON.stringify(calls[0].messages),/선택한 원문 문장/);
  await page.getByRole("button",{name:"최근 답변 사용"}).click();
  const wordEdit = page.getByLabel("Word에 반영할 수정안");
  await expect(wordEdit).toHaveValue("검토 결과 complete");
  await wordEdit.fill("검토를 마친 문장입니다.");
  await page.getByRole("button",{name:"Word에 수정안 보내기"}).click();
  await expect(page.locator(".word-selection [role=status]")).toContainText("수정안을 보냈습니다");
  assert.deepEqual(JSON.parse(await readFile(path.join(root,wordId+".reply.json"),"utf8")),{id:wordId,text:"검토를 마친 문장입니다."});
  assert.equal(await readFile(path.join(root,wordId+".ready"),"utf8"),"");
  await page.getByRole("button",{name:"Word 선택 영역 닫기"}).click();
  await expect(page.locator(".word-selection")).toBeHidden();
  await page.getByLabel("xcode 메시지").fill("wait-for-cancel");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => calls.length).toBe(3);
  await page.getByRole("button", { name: "중지", exact: true }).click();
  await expect(page.locator(".xcode [role=alert]")).toContainText("중지");
  assert.match(JSON.stringify(calls[2].messages), /Review this/);
  // A pending first session completes while a second page is open.
  caseMode = "hold";
  await page.getByLabel("템플릿 적용").selectOption("직접 대화");
  await page.getByRole("button",{name:"전체 단계 적용"}).click();
  await page.getByLabel("xcode 메시지").fill("parallel-first");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => Boolean(slowResponse)).toBe(true);
  await expect(page.locator('.page-tree .session-state-dot[data-state="running"]')).toHaveCount(1);
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "xcode 세션 만들기" }).click();
  await page.getByLabel("API 주소").fill(endpoint);
  await page.getByLabel("xcode 메시지").fill("parallel-second");
  caseMode = "normal";
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect(page.locator(".xcode article")).toContainText("parallel-second");
  slowResponse.writeHead(200, { "content-type": "text/event-stream" });
  slowResponse.end(
    'data: {"choices":[{"delta":{"content":"first finished"}}]}\n\ndata: [DONE]\n\n',
  );
  await expect
    .poll(async () =>
      page.evaluate(
        async (id) => (await window.xdocs.readNote(id)).body,
        note.id,
      ),
    )
    .toContain("first finished");
  await expect(page.locator(".xcode article")).not.toContainText(
    "first finished",
  );
  const send = page.getByRole("button", { name: "전송", exact: true }),
    input = page.getByLabel("xcode 메시지");
  await openAdvanced();
  await page.getByLabel("이어지는 응답 자동 요청").check();
  await page.getByLabel("재요청 간격(초)").fill("1");
  caseMode = "temporary";
  await input.fill("retry-case");
  await send.click();
  await expect(page.locator(".xcode article").last()).toContainText(
    "retry-case",
  );
  assert.equal(retryCalls, 2);
  assert.match(JSON.stringify(calls.at(-1).messages.at(-1)), /계속해주세요/);
  for (const kind of ["429", "quota"]) {
    caseMode = kind;
    const before = calls.length;
    await input.fill("stop-" + kind);
    await send.click();
    await expect(page.locator(".xcode [role=alert]")).toContainText("사용량");
    await new Promise((r) => setTimeout(r, 1100));
    assert.equal(calls.length, before + 1);
  }
  caseMode = "normal";
  await page.getByLabel("재요청 방식").selectOption("repeat");
  await input.fill("repeat-case");
  await send.click();
  await expect(page.locator(".xcode article").last()).toContainText(
    "계속해주세요",
  );
  await page.getByLabel("이어지는 응답 자동 요청").uncheck();
  await expect(send).toBeDisabled(); // The completed prompt has been cleared.
  const stopped = calls.length;
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(calls.length, stopped);
  await page.getByLabel("자동 요청 한도(회)").fill("1");
  await openAdvanced();
  await page.getByLabel("이어지는 응답 자동 요청").check();
  await input.fill("budget-case");
  await send.click();
  await expect(page.locator(".xcode [role=alert]")).toContainText("1회에 도달");
  assert.equal(calls.length, stopped + 2);
  await page.getByLabel("이어지는 응답 자동 요청").uncheck();
  await page.getByLabel("서버 동시 요청 수").selectOption("1");
  slowResponse = null;
  caseMode = "hold";
  await input.fill("held-session");
  await send.click();
  await expect.poll(() => Boolean(slowResponse)).toBe(true);
  const firstCount = calls.length;
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "xcode 세션 만들기" }).click();
  await page.getByLabel("API 주소").fill(endpoint);
  await expect(page.getByLabel("서버 동시 요청 수")).toHaveValue("1");
  await input.fill("queued-session");
  await send.click();
  await expect(page.locator(".xcode [role=status]")).toContainText(
    "서버 대기열",
  );
  await page
    .locator(".xcode")
    .getByRole("button", { name: "중지", exact: true })
    .click();
  await expect(page.locator(".xcode [role=alert]")).toContainText("중지");
  await send.click();
  await expect(page.locator(".xcode [role=status]")).toContainText(
    "서버 대기열",
  );
  await page.locator(".xcode-running summary").click();
  await page.getByRole("button", { name: "실행 중인 세션 모두 중지" }).click();
  await expect(page.locator(".xcode-running")).toHaveCount(0);
  assert.equal(calls.length, firstCount);
  caseMode = "normal";
  await send.click();
  await expect(page.locator(".xcode article").last()).toContainText(
    "queued-session",
  );
  slowResponse = null;
  caseMode = "hold";
  await input.fill("queue-owner");
  await send.click();
  await expect.poll(() => Boolean(slowResponse)).toBe(true);
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "xcode 세션 만들기" }).click();
  await page.getByLabel("API 주소").fill(endpoint);
  await input.fill("queue-successor");
  await send.click();
  await expect(page.locator(".xcode [role=status]")).toContainText(
    "서버 대기열",
  );
  caseMode = "normal";
  slowResponse.writeHead(200, { "content-type": "text/event-stream" });
  slowResponse.end(
    'data: {"choices":[{"delta":{"content":"released"}}]}\n\ndata: [DONE]\n\n',
  );
  await expect(page.locator(".xcode article").last()).toContainText(
    "queue-successor",
  );

  await page.clock.install();
  await openAdvanced();
  await page.getByLabel("이어지는 응답 자동 요청").check();
  await page.getByLabel("재요청 방식").selectOption("repeat");
  await page.getByLabel("재요청 간격(초)").fill("3600");
  await page.getByLabel("자동 실행 한도(분)").fill("1");
  await input.fill("deadline");
  const beforeDeadline = calls.length;
  await send.click();
  await expect(page.locator(".xcode [role=status]")).toContainText(
    "다음 대화 대기",
  );
  await page.clock.fastForward(61000);
  await expect(page.locator(".xcode [role=alert]")).toContainText(
    "자동 실행 시간 한도",
  );
  assert.equal(calls.length, beforeDeadline + 1);
  console.log(
    "PASS xcode: streaming, harnesses, concurrent page isolation, retries, quota stops and repeat cancellation",
  );
} finally {
  if (app) await app.close();
  server.closeAllConnections();
  server.close();
  await rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
