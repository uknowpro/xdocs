// Connection details live only for the duration of the user's request.
function parseModelEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw Error("세션 설정에서 Chat Completions의 전체 API 주소를 확인하세요.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("올바른 HTTP 또는 HTTPS API 주소를 입력하세요.");
  return url;
}

export function isRemoteHttpEndpoint(url) {
  return (
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  );
}

export function builderEndpoint(endpoint) {
  const url = parseModelEndpoint(endpoint);
  if (isRemoteHttpEndpoint(url))
    throw Error("HTTPS 또는 로컬 HTTP 모델 주소를 입력하세요.");
  return url;
}
export function chatCompletionsEndpoint(endpoint) {
  const url = parseModelEndpoint(endpoint);
  if (/\/v1\/?$/.test(url.pathname))
    url.pathname = url.pathname.replace(/\/$/, "") + "/chat/completions";
  return url;
}

export function sameChatEndpoint(first, second) {
  if (first === second) return true;
  try {
    return (
      chatCompletionsEndpoint(first).href ===
      chatCompletionsEndpoint(second).href
    );
  } catch {
    return false;
  }
}

export async function runBuilderModel({ endpoint, model, key, prompt }) {
  const url = builderEndpoint(endpoint);
  if (
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.length > 100000 ||
    typeof model !== "string" ||
    !model.trim()
  )
    throw Error("모델 이름과 입력 길이(최대 10만 자)를 확인하세요.");
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(90000),
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: "Bearer " + key } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });
  if (!response.ok)
    throw Error("모델 요청 실패 (HTTP " + response.status + ")");
  const body = await response.json();
  const answer = body.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim())
    throw Error("모델의 텍스트 응답을 읽을 수 없습니다.");
  return answer;
}
