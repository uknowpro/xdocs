export const publishedHarness = "<!-- xdocs:published-harness -->";
export const skills = {
  over: {
    label: "기준 초과",
    instruction: "기준을 초과한 행을 근거 셀과 함께 요약하세요.",
  },
  empty: {
    label: "누락값",
    instruction: "값이 비어 있는 셀과 확인이 필요한 항목을 정리하세요.",
  },
  contains: {
    label: "문구 포함",
    instruction: "해당 문구가 있는 행을 묶어 근거와 함께 정리하세요.",
  },
  duplicate: {
    label: "중복값",
    instruction: "같은 값이 반복되는 행을 묶어 비교하세요.",
  },
};
export const prompts = {
  evidence:
    "각 판단에 원본 셀 주소를 붙이고 확인이 필요한 내용은 질문으로 남기세요.",
  brief: "결론, 영향, 다음 조치 순서로 간결한 업무 메모를 작성하세요.",
  rubric: "항목별로 근거와 검토 필요성을 평가표로 정리하세요.",
  json: "각 항목을 cell, finding, follow_up 필드가 있는 JSON 배열로 반환하세요.",
  compare: "사례 사이의 공통점과 차이점을 근거 셀과 함께 비교하세요.",
  questions:
    "근거로 확인할 수 없는 사항을 담당자에게 물을 질문으로 정리하세요.",
  actions:
    "근거에서 결정된 조치, 담당자, 기한을 추출하고 미정 항목을 표시하세요.",
  triage: "요청을 분야별로 분류하고 각 분류의 근거를 한 줄로 작성하세요.",
  translation:
    "근거 인용과 고유 명사를 유지해 한국어와 영어 요약을 함께 작성하세요.",
  timeline: "근거에서 확인 가능한 사건만 시간 순으로 정리하세요.",
  risks: "확인된 사실, 예상 위험, 추가로 확인할 사항을 구분하세요.",
  checklist: "담당자가 확인할 항목을 체크리스트로 작성하세요.",
};
export const presets = {
  upgrade: {label:"Analyzer 업그레이드 조치",rule:"contains",keyword:"업그레이드 조치",prompt:"actions",input:"note"},
  network: {label:"Analyzer 인바운드·아웃바운드 검토",rule:"contains",keyword:"inbound",prompt:"evidence",input:"note"},
  meeting: {
    label: "회의 액션 아이템",
    rule: "contains",
    keyword: "- [ ]",
    prompt: "actions",
    input: "note",
  },
  incident: {
    label: "장애 회고",
    rule: "contains",
    keyword: "장애",
    prompt: "timeline",
    input: "note",
  },
  requirements: {
    label: "요구사항 검토",
    rule: "contains",
    keyword: "요구",
    prompt: "questions",
    input: "note",
  },
  cost: { label: "월간 비용 검토", rule: "over", prompt: "evidence" },
  quality: { label: "데이터 품질 점검", rule: "empty", prompt: "checklist" },
  inventory: { label: "자산 중복 점검", rule: "duplicate", prompt: "compare" },
};
export function newBuilder(preset = "cost") {
  const template = presets[preset];
  return {
    version: 1,
    source: "",
    sheet: "",
    input: template.input || "sheet",
    rules: [
      {
        kind: template.rule,
        column: 0,
        threshold: 0,
        keyword: template.keyword || "",
        label: skills[template.rule].label,
        instruction: skills[template.rule].instruction,
      },
      ...(preset === "network" ? [{kind:"contains",column:0,threshold:0,keyword:"outbound",label:"아웃바운드",instruction:"외부 호출을 원본 줄과 함께 정리하세요."}] : []),
    ],
    prompt: prompts[template.prompt],
  };
}
const fence = /^```xdocs-builder\r?\n([^]*?)\r?\n```$/m;
export function encodeBuilder(config) {
  return (
    "```xdocs-builder\n" +
    JSON.stringify(config).replaceAll("`", "\\u0060") +
    "\n```"
  );
}
export function decodeBuilder(body) {
  const match = body.match(fence);
  if (!match) return null;
  try {
    const c = JSON.parse(match[1]);
    if (
      c.version === 1 &&
      [undefined, "text", "evidence-json"].includes(c.outputFormat) &&
      [undefined, "note", "sheet"].includes(c.input) &&
      (!c.origin ||
        (typeof c.origin.page === "string" &&
          typeof c.origin.revision === "string")) &&
      typeof c.prompt === "string" &&
      typeof c.source === "string" &&
      typeof c.sheet === "string" &&
      Array.isArray(c.rules) &&
      c.rules.every(
        (r) =>
          r &&
          Object.hasOwn(skills, r.kind) &&
          (r.keyword === undefined || typeof r.keyword === "string") &&
          Number.isInteger(r.column) &&
          r.column >= 0 &&
          Number.isFinite(r.threshold) &&
          typeof r.label === "string" &&
          typeof r.instruction === "string",
      )
    )
      return c;
  } catch {}
  return null;
}
export const replaceBuilder = (body, config) =>
  body.replace(fence, () => encodeBuilder(config));
function columnName(index) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}
export function reviewSheet(sheet, rules) {
  const rows = sheet.rows.slice(1);
  const findings = [];
  let total = 0;
  const steps = [];
  let previous = null;
  for (const rule of rules) {
    const started = performance.now();
    const candidates =
      rule.input === "previous" && previous ? previous : rows.map((_, i) => i);
    const matchedIndices = [];
    const counts = new Map();
    const valueAt = (row) => (row[rule.column] || "").trim();
    if (rule.kind === "duplicate")
      for (const i of candidates) {
        const v = valueAt(rows[i]);
        if (v) counts.set(v, (counts.get(v) || 0) + 1);
      }
    candidates.forEach((i) => {
      const v = valueAt(rows[i]);
      const number = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(v)
        ? Number(v.replaceAll(",", ""))
        : NaN;
      const matched =
        rule.kind === "contains"
          ? !!rule.keyword &&
            v.toLocaleLowerCase().includes(rule.keyword.toLocaleLowerCase())
          : rule.kind === "empty"
            ? !v
            : rule.kind === "duplicate"
              ? counts.get(v) > 1
              : number > rule.threshold;
      if (!matched) return;
      total++;
      matchedIndices.push(i);
      if (findings.length < 200)
        findings.push({
          cell: sheet.noteLines
            ? sheet.name + " L" + (i + 1)
            : sheet.name + "!" + columnName(rule.column) + (i + 2),
          value: v,
          label: rule.label,
        });
    });
    previous = matchedIndices;
    steps.push({
      label: rule.label,
      inputs: candidates.length,
      matches: matchedIndices.length,
      ms: performance.now() - started,
    });
    if (!matchedIndices.length && rule.stopOnEmpty) break;
  }
  return { findings, total, steps };
}

export function evaluateEvidenceJson(text, findings) {
  let doc;
  try { doc = JSON.parse(text); } catch { return { error: "JSON 구문을 읽을 수 없습니다." }; }
  if (typeof doc?.summary !== "string" || !Array.isArray(doc.evidence) ||
      !doc.evidence.every(ref => typeof ref === "string"))
    return { error: "summary 문자열과 evidence 문자열 배열이 필요합니다." };
  const expected = new Set(findings.map(finding => finding.cell));
  const cited = new Set(doc.evidence);
  return {
    missing: [...expected].filter(ref => !cited.has(ref)),
    unknown: [...cited].filter(ref => !expected.has(ref)),
  };
}
