import type { Attachment } from "./types";
import { unzipSync, strFromU8 } from "fflate";
export const templates: Record<string, string[]> = {
  "직접 대화": ["요청에 직접 답하고 필요한 경우 근거를 표시하세요."],
  "코드 검토": [
    "제공된 코드의 흐름과 요구사항을 파악하세요.",
    "정확성과 유지보수 문제를 근거 및 수정 제안과 함께 정리하세요.",
  ],
  "인프라 변경 검토": [
    "리소스 관계와 변경 범위를 정리하세요.",
    "운영 영향과 검증 절차를 작성하세요.",
  ],
  "이미지·문서 분석": [
    "첨부에서 확인되는 사실과 불확실한 부분을 구분하세요.",
    "요청한 결과를 출처와 함께 정리하세요.",
  ],
  "기술 설계": [
    "목표와 제약을 정리하고 설계 대안을 비교하세요.",
    "선택한 설계의 구현 단계와 검증 기준을 작성하세요.",
  ],
};
export type Harness = {
  name: string;
  stages: string[];
  effort?: string;
  historyTurns?: number;
  skills: { name: string; instruction: string }[];
};
export type InputFile = { name: string; text: string } | Attachment;
export type Turn = {
  prompt: string;
  files: InputFile[];
  answers: { stage: string; text: string; elapsedMs?: number }[];
};
export type Session = {
  endpoint: string;
  model: string;
  profile: string;
  harness: Harness;
  turns: Turn[];
};
export function preset(name: string): Harness {
  return { name, stages: [...templates[name]], skills: [] };
}
export function fresh(): Session {
  return {
    endpoint: "http://127.0.0.1:8000/v1/chat/completions",
    model: "deepseek-ai/DeepSeek-V4.1-Flash",
    profile: "",
    harness: preset("직접 대화"),
    turns: [],
  };
}
const block = /^```xdocs-xcode\r?\n([^]*?)\r?\n```$/m;
export function pack(s: Session) {
  return (
    "```xdocs-xcode\n" + JSON.stringify(s).replaceAll("`", "\\u0060") + "\n```"
  );
}
export function replaceSession(body: string, s: Session) {
  return body.replace(block, () => pack(s));
}
export function decode(body: string): Session | null {
  const m = body.match(block);
  if (!m) return null;
  try {
    const s = JSON.parse(m[1]);
    return validHarness(s.harness) &&
      Array.isArray(s.turns) &&
      s.turns.every(
        (t: Turn) =>
          t &&
          typeof t.prompt === "string" &&
          Array.isArray(t.answers) &&
          t.answers.every(
            (a) => typeof a?.text === "string" && typeof a.stage === "string",
          ) &&
          Array.isArray(t.files) &&
          t.files.every(
            (f) =>
              f &&
              typeof f.name === "string" &&
              ("text" in f
                ? typeof f.text === "string"
                : typeof f.path === "string" &&
                  ["pdf", "image"].includes(f.kind)),
          ),
      ) &&
      typeof s.endpoint === "string" &&
      typeof s.model === "string"
      ? s
      : null;
  } catch {
    return null;
  }
}
export function validHarness(h: Harness) {
  return (
    h &&
    typeof h.name === "string" &&
    (!h.effort ||
      ["low", "medium", "high", "xhigh", "max"].includes(h.effort)) &&
    (h.historyTurns === undefined ||
      (Number.isSafeInteger(h.historyTurns) &&
        h.historyTurns >= 0 &&
        h.historyTurns <= 100)) &&
    Array.isArray(h.stages) &&
    h.stages.length > 0 &&
    h.stages.length <= 12 &&
    h.stages.every((s) => typeof s === "string") &&
    Array.isArray(h.skills) &&
    h.skills.every(
      (s) => typeof s?.name === "string" && typeof s.instruction === "string",
    )
  );
}
export async function documentInput(f: File): Promise<InputFile> {
  if (f.size > 8 * 1024 * 1024) throw Error("문서는 8MB 이하로 선택하세요.");
  let text: string;
  if (/\.(docx|pptx|xlsx)$/i.test(f.name)) {
    const parts: string[] = [];
    let bytes = 0;
    const zip = unzipSync(new Uint8Array(await f.arrayBuffer()), {
      filter: (e) => {
        if (
          !/^(word\/document|ppt\/slides\/slide\d+|xl\/sharedStrings|xl\/worksheets\/sheet\d+)\.xml$/.test(
            e.name,
          )
        )
          return false;
        bytes += e.originalSize;
        if (bytes > 16 * 1024 * 1024)
          throw Error("문서의 압축 해제 범위가 너무 큽니다.");
        return true;
      },
    });
    const xml = (name: string) =>
      new DOMParser().parseFromString(strFromU8(zip[name]), "application/xml");
    const strings = zip["xl/sharedStrings.xml"]
      ? Array.from(
          xml("xl/sharedStrings.xml").getElementsByTagName("si"),
          (e) => e.textContent || "",
        )
      : [];
    for (const name of Object.keys(zip).sort((a, b) =>
      a.localeCompare(b, "en", { numeric: true }),
    )) {
      if (name === "xl/sharedStrings.xml") continue;
      const doc = xml(name);
      if (doc.getElementsByTagName("parsererror").length)
        throw Error("문서 XML을 읽을 수 없습니다.");
      if (name.startsWith("xl/")) {
        parts.push(
          name,
          ...Array.from(doc.getElementsByTagName("row"), (row) =>
            Array.from(row.getElementsByTagName("c"), (c) => {
              const v = c.getElementsByTagName("v")[0]?.textContent || "";
              return (
                (c.getAttribute("r") || "") +
                "=" +
                (c.getAttribute("t") === "s"
                  ? strings[Number(v)] || ""
                  : v || c.textContent)
              );
            }).join("\t"),
          ),
        );
      } else
        parts.push(
          name,
          ...Array.from(doc.getElementsByTagNameNS("*", "p"), (p) =>
            Array.from(
              p.getElementsByTagNameNS("*", "t"),
              (n) => n.textContent,
            ).join(""),
          ),
        );
    }
    text = parts.join("\n");
  } else {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await f.arrayBuffer(),
    );
    if (text.includes("\0"))
      throw Error("텍스트 또는 지원되는 문서를 선택하세요.");
  }
  if (!text.trim() || text.length > 160000)
    throw Error("문서 텍스트는 비어 있지 않고 16만 자 이하여야 합니다.");
  return { name: f.name, text };
}
