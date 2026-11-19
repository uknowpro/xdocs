import type { Attachment } from "./types";
import { unzipSync, strFromU8 } from "fflate";
export const templates: Record<string, string[]> = {
  "DeepSeek · 근거 기반 답변": [
    "요청한 결과를 먼저 제시하세요. 첨부에서 가져온 주장은 파일명과 위치를 제시하고, 자료가 부족한 부분은 확인할 항목으로 남기세요.",
  ],
  "DeepSeek · 변경안 작성": [
    "첨부에서 성공 조건, 변경할 파일·심볼, 유지해야 할 동작을 추출하세요. 다음 단계에서 사용할 짧은 작업 명세를 작성하세요.",
    "작업 명세와 원본을 대조해 필요한 변경안을 작성하세요. 코드 변경 요청이면 파일별 패치와 예상 동작을 제시하세요.",
    "제안이 요구사항, 경계값, 기존 호출자와 맞는지 원본에 대조하세요. 발견한 오류를 수정한 최종 변경안과 사용자가 실행할 검증 절차를 제시하세요.",
  ],
  "DeepSeek · 인프라 의사결정": [
    "제공된 IaC, 도면, 운영 문서에서 현재 구성·제약·요구사항을 추출하고 출처를 붙이세요.",
    "제약을 만족하는 설계 대안을 장애 범위, 데이터 경계, 비용 요인과 운영 복잡도로 비교하고 하나를 선택하세요.",
    "선택한 방안이 실패할 조건을 점검하고 최종 결정, 전환 순서, 되돌리는 조건과 남은 확인 사항을 작성하세요.",
  ],
  "DeepSeek · 시각 자료 판독": [
    "이미지·슬라이드에 보이는 레이블, 위치, 연결 방향과 수치를 출처별로 추출하세요. 판독하기 어려운 부분을 표시하세요.",
    "사용자의 질문에 답하고 각 결론을 관찰 항목 또는 문서 근거에 연결하세요. 자료끼리 상충하는 곳은 양쪽 출처를 제시하세요.",
  ],
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
  stageEfforts?: string[];
  historyTurns?: number;
  skills: { name: string; instruction: string }[];
};
export type InputFile = { name: string; text: string } | Attachment;
export type Turn = {
  prompt: string;
  files: InputFile[];
  execution?: { model: string; harness: string; skills: string[] };
  answers: {
    stage: string;
    text: string;
    elapsedMs?: number;
    effort?: string;
    retries?: number;
  }[];
};
export type Session = {
  endpoint: string;
  model: string;
  profile: string;
  harness: Harness;
  turns: Turn[];
  repeatCompleted?: boolean;
  autoRetry?: boolean;
  retrySeconds?: number;
  autoMinutes?: number;
  maxAutoRequests?: number;
};
export function preset(name: string): Harness {
  const policies: Record<string, string[]> = {
    "DeepSeek · 변경안 작성": ["low", "high", "high"],
    "DeepSeek · 인프라 의사결정": ["low", "high", "high"],
    "DeepSeek · 시각 자료 판독": ["low", "high"],
  };
  return {
    name,
    stages: [...templates[name]],
    skills: [],
    ...(policies[name] ? { stageEfforts: policies[name] } : {}),
  };
}
export function fresh(): Session {
  return {
    endpoint: "http://127.0.0.1:8000/v1/chat/completions",
    model: "deepseek-ai/DeepSeek-V4.1-Flash",
    profile: "",
    harness: preset("DeepSeek · 근거 기반 답변"),
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
          (t.execution === undefined ||
            (typeof t.execution?.model === "string" &&
              typeof t.execution.harness === "string" &&
              Array.isArray(t.execution.skills) &&
              t.execution.skills.every(
                (skill) => typeof skill === "string",
              ))) &&
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
    (h.stageEfforts === undefined ||
      (Array.isArray(h.stageEfforts) &&
        h.stageEfforts.length === h.stages.length &&
        h.stageEfforts.every((e) =>
          ["", "server", "low", "medium", "high", "xhigh", "max"].includes(e),
        ))) &&
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
