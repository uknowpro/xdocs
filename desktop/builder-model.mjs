// Connection details live only for the duration of the user's request.
export function builderEndpoint(endpoint) {
  const url = new URL(endpoint);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error("HTTPS 또는 로컬 HTTP 모델 주소를 입력하세요.");
  return url;
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
