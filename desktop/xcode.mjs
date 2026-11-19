import { builderEndpoint } from "./builder-model.mjs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

export async function readSkills(roots) {
  const result = [];
  for (const [scope, root] of roots) {
    const folder = path.join(root, ".claude", "skills");
    const entries = await readdir(folder, { withFileTypes: true }).catch(
      (e) => {
        if (e.code === "ENOENT") return [];
        throw e;
      },
    );
    for (const entry of entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, entry.name, "SKILL.md");
      if (
        (await realpath(file).catch(() => "")) !== file ||
        (await stat(file)).size > 100000
      )
        continue;
      const content = await readFile(file, "utf8");
      const match = /^---\r?\n([^]*?)\r?\n---\r?\n([^]*)$/.exec(content);
      if (!match) continue;
      try {
        const meta = parse(match[1]);
        if (typeof meta?.name === "string" && match[2].trim())
          result.push({ scope, name: meta.name, instruction: match[2].trim() });
      } catch {
        /* Skip individual malformed skill files. */
      }
    }
  }
  return result;
}

export async function streamChat(
  { endpoint, model, key, messages, effort },
  signal,
  onText,
) {
  const url = builderEndpoint(endpoint);
  if (!model?.trim() || !Array.isArray(messages) || !messages.length)
    throw Error("모델 ID와 메시지를 확인하세요.");
  if (effort && !["low", "medium", "high", "xhigh", "max"].includes(effort))
    throw Error("추론 강도를 확인하세요.");
  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    ...(effort ? { reasoning_effort: effort } : {}),
  });
  if (Buffer.byteLength(body) > 32 * 1024 * 1024)
    throw Error("대화와 첨부 합계가 32MB를 넘습니다. 새 세션을 사용하세요.");
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(key ? { Authorization: "Bearer " + key } : {}),
    },
    body,
    signal,
  });
  if (!response.ok)
    throw Error("모델 요청 실패 (HTTP " + response.status + ")");
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    throw Error("서버가 SSE 응답을 반환하지 않았습니다.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    answer = "",
    finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      if (done && buffer.trim()) {
        events.push(buffer);
        buffer = "";
      }
      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        if (data.trim() === "[DONE]") {
          finished = true;
          break;
        }
        const chunk = JSON.parse(data);
        if (chunk.error) throw Error("모델 서버가 스트림 오류를 반환했습니다.");
        const choice = chunk.choices?.[0];
        if (choice?.finish_reason === "length")
          throw Error("모델의 출력 한도에 도달했습니다. 요청 범위를 줄이세요.");
        if (choice?.finish_reason === "stop") finished = true;
        const token = choice?.delta?.content;
        if (typeof token === "string") {
          answer += token;
          if (answer.length > 200000) throw Error("응답이 20만 자를 넘습니다.");
          onText(token);
        }
      }
      if (done || finished) break;
    }
    if (!finished || !answer.trim())
      throw Error("완전한 텍스트 응답을 받지 못했습니다.");
    return answer;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
