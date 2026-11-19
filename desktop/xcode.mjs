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
  }).catch((e) => {
    if (signal.aborted && signal.reason?.name !== "TimeoutError") throw e;
    throw Error("[XCODE_RETRY] 모델 연결이 중단되었습니다.");
  });
  if (!response.ok) {
    const reader = response.body?.getReader();
    const bytes = Buffer.alloc(4096);
    let used = 0;
    try {
      while (reader && used < bytes.length) {
        const {done, value} = await reader.read();
        if (done) break;
        const part = value.subarray(0, bytes.length - used);
        bytes.set(part, used);
        used += part.length;
      }
    } finally {
      await reader?.cancel().catch(() => {});
    }
    const detail = bytes.toString("utf8", 0, used);
    throw modelFailure(response.status, detail);
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    throw Error("서버가 SSE 응답을 반환하지 않았습니다.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let received = 0;
  let buffer = "",
    answer = "",
    finished = false,
    lengthLimited = false;
  try {
    for (;;) {
      const { value, done } = await reader.read().catch((e) => {
        if (signal.aborted && signal.reason?.name !== "TimeoutError") throw e;
        throw Error("[XCODE_RETRY] 스트림 연결이 끊겼습니다.");
      });
      received += value?.byteLength ?? 0;
      if (received > 16 * 1024 * 1024) throw Error("스트림 수신 한도(16 MiB)를 초과했습니다.");
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      if ([...events, buffer].some(part => Buffer.byteLength(part) > 256 * 1024))
        throw Error("스트림 이벤트 한도(256 KiB)를 초과했습니다.");
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
        if (chunk.error)
          throw modelFailure(
            Number(chunk.error.status || chunk.error.code || 0),
            JSON.stringify(chunk.error),
          );
        const choice = chunk.choices?.[0];
        if (choice?.finish_reason === "length") lengthLimited = true;
        if (choice?.finish_reason === "stop") finished = true;
        const token = choice?.delta?.content;
        if (typeof token === "string") {
          answer += token;
          if (answer.length > 200000) throw Error("응답이 20만 자를 넘습니다.");
          onText(token);
        }
      }
      if (lengthLimited)
        throw Error("[XCODE_RETRY] 모델 출력 길이 한도에 도달했습니다.");
      if (done || finished) break;
    }
    if (!finished)
      throw Error("[XCODE_RETRY] 스트림이 완료되기 전에 종료됐습니다.");
    if (!answer.trim()) throw Error("완전한 텍스트 응답을 받지 못했습니다.");
    return answer;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export function modelFailure(status, detail) {
  if (
    status === 429 ||
    status === 402 ||
    /\b429\b|quota|usage.{0,16}(?:exceed|limit)|insufficient[_ ](?:balance|credit)|rate[_ -]?limit|resource[_ ]exhausted|billing|사용량.{0,12}(?:초과|한도)/i.test(
      detail,
    )
  )
    return Error(
      "사용량 또는 요청 한도에 도달했습니다. 자동 재요청을 중단합니다.",
    );
  if (
    [408, 500, 502, 503, 504, 529].includes(status) ||
    (!status &&
      /server_error|overloaded_error|temporarily_unavailable/.test(detail))
  )
    return Error("[XCODE_RETRY] 모델 서버 일시 오류 (HTTP " + status + ")");
  return Error("모델 요청 실패" + (status ? " (HTTP " + status + ")" : ""));
}
