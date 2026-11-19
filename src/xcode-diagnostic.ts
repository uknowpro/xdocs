/// <reference types="vite/client" />
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
