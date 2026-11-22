export type FieldReview = {
  id: string;
  label: string;
  original: string;
  value: unknown;
  included: boolean;
  approved: boolean;
  reason: string;
  sources: string[];
};
export type OfficeOutput={
  filename:string; savedAt:string; sha256:string; bytes:number;
  fields:number; formulas:number; status:"verified"|"structure";
};
export async function officeOutputHash(bytes:Uint8Array){
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes))),byte=>byte.toString(16).padStart(2,"0")).join("");
}
export type OfficeReview = {
  output?:OfficeOutput;
  form: string;
  identity: string;
  reviewedAt: string;
  fields: FieldReview[];
};
export function downloadReview(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name + ".md";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export const markdownQuote = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => "> " + line)
    .join("\n");
export const reviewValue = (value: unknown) =>
  typeof value === "string"
    ? value
    : value === undefined
      ? ""
      : JSON.stringify(value, null, 2);
export function officeReviewMarkdown(review?: OfficeReview) {
  if (!review) return "";
  return [
    "## Office 양식 검토",
    "",
    markdownQuote(review.form + " · " + review.reviewedAt),
    ...(review.output ? ["",markdownQuote([
      "작성본 "+review.output.filename,review.output.savedAt,
      review.output.status==="verified"?"작성본 검사 통과":"Word 구조 검사 통과",
      "SHA-256 "+review.output.sha256,
    ].join("\n"))] : []),
    "",
    ...review.fields.flatMap((field) => [
      "### " + field.label.replace(/[\r\n]/g, " "),
      "",
      field.included ? "반영 선택" : "보류",
      field.approved ? "검토 승인" : "검토 미승인",
      "",
      markdownQuote(
        "원본 값\n" +
          (field.original || "(빈 값)") +
          "\n\n제안 값\n" +
          (reviewValue(field.value) || "(빈 값)"),
      ),
      ...(field.sources.length
        ? ["", markdownQuote("출처\n" + field.sources.join("\n"))]
        : []),
      ...(field.reason
        ? ["", markdownQuote("검토 사유\n" + field.reason)]
        : []),
      "",
    ]),
  ].join("\n");
}
