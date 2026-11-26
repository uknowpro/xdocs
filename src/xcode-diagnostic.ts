/// <reference types="vite/client" />
import { chatCompletionsEndpoint } from "../desktop/builder-model.mjs";
import { api } from "./api";
import { acquireServer } from "./xcode-queue";
import type { SessionConnection } from "./xcode-session";
import image from "./assets/diagnostics/sample.png?inline";
import pdf from "./assets/diagnostics/sample.pdf?inline";

export type Probe = "text" | "image" | "pdf";
export function diagnosticInput(kind: Probe) {
  const prompt = {
    type: "text",
    text: "Return only the six characters shown in the attachment.",
  };
  if (kind === "image")
    return [prompt, { type: "image_url", image_url: { url: image } }];
  if (kind === "pdf")
    return [
      prompt,
      { type: "file", file: { filename: "sample.pdf", file_data: pdf } },
    ];
  return "Reply with OK.";
}
export function diagnosticResult(kind: Probe, answer: string) {
  const connection = "설정한 모델에서 SSE 텍스트 응답을 받았습니다.";
  if (kind === "text") return connection;
  const expected = kind === "image" ? "BIRD72" : "MOON43";
  return (
    connection +
    (answer.toUpperCase().includes(expected)
      ? " 샘플 판독에 성공했습니다."
      : " 샘플의 문자와 응답이 일치하지 않습니다.")
  );
}


export async function testXcodeConnection(
  connection: SessionConnection & { key: string },
  probe: Probe,
  id: string,
  signal: AbortSignal,
) {
  const { endpoint, model } = connection;
  let address: URL;
  try {
    address = chatCompletionsEndpoint(endpoint);
  } catch {
    throw Error("주소 · HTTP 또는 HTTPS API 주소를 확인하세요.");
  }
  if (!model.trim()) throw Error("모델 · 서버에서 사용하는 모델명을 입력하세요.");
  if (!api.xcodeChat || !api.xcodeAuthorize) throw Error("연결 테스트는 데스크톱 앱에서 실행합니다.");
  signal.throwIfAborted();
  if (!await api.xcodeAuthorize(endpoint))
    throw Error("서버 전송을 취소했습니다.");
  const release = await acquireServer(address.origin, signal);
  try {
    signal.throwIfAborted();
    const answer = await api.xcodeChat({
      id,
      ...connection,
      model: model.trim(),
      messages: [{ role: "user", content: diagnosticInput(probe) }],
    });
    signal.throwIfAborted();
    return diagnosticResult(probe, answer);
  } finally {
    release();
  }
}

export function diagnosticFailure(error: unknown) {
  const detail = (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
    .replace(/^\[XCODE_RETRY\] /, "");
  if (/HTTP (401|403)\b/.test(detail))
    return "인증 · API 토큰 또는 이 모델의 접근 권한을 확인하세요. (" + detail.match(/HTTP \d+/)?.[0] + ")";
  if (/모델을 찾을 수 없습니다/.test(detail)) return "모델 · 서버에서 제공하는 정확한 모델 ID를 확인하세요.";
  if (/HTTP 404\b/.test(detail)) return "주소 또는 모델 · 서버가 HTTP 404를 반환했습니다. 요청 경로와 모델 ID를 확인하세요.";
  if (/HTTP 407\b/.test(detail)) return "인증 · 사내 프록시 인증과 접근 권한을 확인하세요.";
  return detail;
}
