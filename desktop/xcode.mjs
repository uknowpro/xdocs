import { chatCompletionsEndpoint } from "./builder-model.mjs";
import { readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

export async function readSkills(roots) {
  const result = [];
  for (const [scope, root] of roots) {
    const config = path.join(root, ".claude");
    const folder = path.join(config, "skills");
    if (!(await lstat(config).catch(() => null))?.isDirectory() ||
        !(await lstat(folder).catch(() => null))?.isDirectory()) continue;
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
      const info = await lstat(file).catch(() => null);
      if (!info?.isFile() || info.size > 100000) continue;
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

function connectionMessage(error, signal) {
  const chromium = /\bnet::(ERR_[A-Z0-9_]+)\b/.exec(error?.message || "")?.[1];
  const code = chromium ?? error?.cause?.code ?? error?.cause?.errors?.[0]?.code ?? "";
  if (/PROXY|TUNNEL/.test(code))
    return "모델 서버에 프록시로 연결할 수 없습니다. 이 기기의 사내 프록시 설정과 접근 권한을 확인하세요.";
  if (/CERT|SSL|TLS|UNABLE_TO_VERIFY_LEAF_SIGNATURE/.test(code))
    return "모델 서버의 HTTPS 인증서를 확인할 수 없습니다. 서버 인증서와 이 기기의 신뢰 설정을 확인하세요.";
  if (/TIMEOUT|TIMED_OUT|ETIMEDOUT/.test(code) || signal.reason?.name === "TimeoutError")
    return "모델 서버 응답 시간이 초과되었습니다. 서버 상태와 네트워크 연결을 확인하세요.";
  if (/ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED|ERR_DNS_/.test(code))
    return "모델 서버 주소를 찾을 수 없습니다. API 주소와 사내 DNS 또는 VPN 연결을 확인하세요.";
  if (code === "ECONNREFUSED" || code === "ERR_CONNECTION_REFUSED")
    return "모델 서버에 연결할 수 없습니다. 서버가 실행 중인지와 API 주소의 포트를 확인하세요.";
  if (/ADDRESS_UNREACHABLE|EHOSTUNREACH|ENETUNREACH|ERR_NETWORK_CHANGED/.test(code))
    return "모델 서버에 도달할 수 없습니다. 이 기기의 사내망 또는 VPN 연결을 확인하세요.";
  const detail = /^[A-Z0-9_]{1,64}$/.test(code) ? " (" + code + ")" : "";
  return "모델 연결이 중단되었습니다" + detail + ". API 주소와 서버 상태를 확인하세요.";
}

export async function streamChat(
  { endpoint, model, key, messages, effort },
  signal,
  onText,
  fetchResponse = fetch,
) {
  const url = chatCompletionsEndpoint(endpoint);
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
  const response = await fetchResponse(url.href, {
    method: "POST",
    redirect: "error",
    credentials: "omit",
    bypassCustomProtocolHandlers: true,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(key ? { Authorization: "Bearer " + key } : {}),
    },
    body,
    signal,
  }).catch((e) => {
    if (signal.aborted && signal.reason?.name !== "TimeoutError") throw e;
    if (
      e?.message === "Attempted to redirect, but redirect policy was 'error'" ||
      e?.cause?.message === "unexpected redirect"
    )
      throw Error("API 주소가 다른 경로로 이동합니다. 세션 설정에 최종 Chat Completions 주소를 입력하세요.");
    throw Error("[XCODE_RETRY] " + connectionMessage(e, signal));
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
  if (status === 413 || ([400,422].includes(status) && /context.length|maximum context|too many tokens|prompt is too long|input.{0,12}too long/i.test(detail)))
    return Error("모델 입력 한도를 초과했습니다. 이전 대화나 첨부를 제외하고 다시 보내세요.");
  if (status === 407) return Error("HTTP 407 · 사내 프록시 인증과 접근 권한을 확인하세요.");
  if (status === 401 || status === 403) return Error("HTTP " + status + " · 세션 설정에서 API 토큰과 모델 접근 권한을 확인하세요.");
  if (status === 404) return Error("HTTP 404 · API 전체 주소와 서버가 제공하는 모델명을 확인하세요.");
  if (status === 400 || status === 422) return Error("HTTP " + status + " · 고급 설정에서 텍스트 연결 진단을 실행하고 첨부 형식과 단계별 추론 옵션을 확인하세요.");
  return Error("모델 요청 실패" + (status ? " (HTTP " + status + ")" : ""));
}
