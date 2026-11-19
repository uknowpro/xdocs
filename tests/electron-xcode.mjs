import { zipSync, strToU8 } from "fflate";
import { _electron, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
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
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const packet = JSON.parse(Buffer.concat(chunks));
  calls.push(packet);
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
  const page = await app.firstWindow();
  await page.getByRole("button", { name: "xcode 세션 만들기" }).click();
  await page.getByLabel("Chat Completions 주소").fill(endpoint);
  await page.getByText("하네스 구성 · 직접 대화").click();
  await page.getByLabel("템플릿 적용").selectOption("코드 검토");
  await page.getByLabel("추론 강도").selectOption("high");
  await page.getByRole("button", { name: ".claude 스킬 찾기" }).click();
  await page
    .getByRole("button", { name: "워크스페이스 · evidence 추가" })
    .click();
  await page.locator(".xcode input[type=file][multiple]").setInputFiles([
    {
      name: "hello.py",
      mimeType: "text/plain",
      buffer: Buffer.from("print(42)"),
    },
    ...[
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
  await page.getByLabel("xcode 메시지").fill("Review this.");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect(page.locator(".xcode article").first()).toContainText(
    "검토 결과 complete",
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].reasoning_effort, "high");
  assert.match(calls[0].messages[0].content, /Cite source filenames/);
  assert.match(JSON.stringify(calls[0].messages), /print\(42\)/);
  assert.match(JSON.stringify(calls[0].messages), /data:image\/png;base64,/);
  for (const expected of [
    "Document evidence",
    "Slide evidence",
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
  assert.doesNotMatch(note.body, /iVBORw0/);
  await page.getByLabel("xcode 메시지").fill("wait-for-cancel");
  await page.getByRole("button", { name: "전송", exact: true }).click();
  await expect.poll(() => calls.length).toBe(3);
  await page.getByRole("button", { name: "중지", exact: true }).click();
  await expect(page.locator(".xcode [role=alert]")).toContainText("중지");
  assert.match(JSON.stringify(calls[2].messages), /Review this/);
  console.log(
    "PASS xcode: session persistence, multimodal history, streamed UTF-8, custom staged harness, Claude skill and cancellation",
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
