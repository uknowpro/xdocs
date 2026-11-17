import { sheetMarkdown } from "./tabular.mjs";
export const INFRA_LIMITS = { resources: 5000, bytes: 4_000_000 };
const text = (v) => typeof v === "string" && v.length <= 1000;
export function validateInfrastructure(value) {
  if (
    !value ||
    value.version !== 1 ||
    !["terraform", "kubernetes", "compose"].includes(value.format) ||
    !text(value.source) ||
    !text(value.importedAt) ||
    !Array.isArray(value.resources) ||
    value.resources.length > INFRA_LIMITS.resources ||
    !Array.isArray(value.warnings) ||
    value.warnings.some((v) => !text(v))
  )
    throw Error("지원하지 않는 인프라 문서입니다.");
  const ids = new Set();
  for (const r of value.resources) {
    if (
      !r ||
      !text(r.id) ||
      !r.id ||
      ids.has(r.id) ||
      !text(r.kind) ||
      !text(r.name) ||
      !text(r.scope) ||
      !Array.isArray(r.dependencies) ||
      r.dependencies.length > 5000 ||
      r.dependencies.some((v) => !text(v)) ||
      !Array.isArray(r.actions) ||
      r.actions.some(
        (v) =>
          ![
            "create",
            "read",
            "update",
            "delete",
            "no-op",
            "forget",
            "import",
          ].includes(v),
      ) ||
      !r.properties ||
      typeof r.properties !== "object" ||
      Array.isArray(r.properties) ||
      Object.values(r.properties).some(
        (v) =>
          !["string", "number", "boolean"].includes(typeof v) ||
          String(v).length > 1000 ||
          (typeof v === "number" && !Number.isFinite(v)),
      )
    )
      throw Error("인프라 리소스 형식 또는 크기를 확인해 주세요.");
    ids.add(r.id);
  }
  if (
    value.notes &&
    (typeof value.notes !== "object" ||
      Array.isArray(value.notes) ||
      Object.values(value.notes).some(
        (v) => typeof v !== "string" || v.length > 20000,
      ))
  )
    throw Error("운영 메모가 너무 큽니다.");
  if (
    new TextEncoder().encode(JSON.stringify(value)).length > INFRA_LIMITS.bytes
  )
    throw Error("인프라 문서는 4 MB 이하만 지원합니다.");
  return value;
}
export function encodeInfrastructure(value) {
  return (
    "```xdocs-infra\n" +
    JSON.stringify(validateInfrastructure(value)).replaceAll("`", "\\u0060") +
    "\n```"
  );
}
export function decodeInfrastructure(body) {
  const m = body.match(/^```xdocs-infra\r?\n([^]*?)\r?\n```$/m);
  return m ? validateInfrastructure(JSON.parse(m[1])) : null;
}
export function replaceInfrastructure(body, value) {
  return body.replace(/^```xdocs-infra\r?\n[^]*?\r?\n```$/m, () =>
    encodeInfrastructure(value),
  );
}
const comparable = (r) =>
  JSON.stringify([
    r.kind,
    r.name,
    r.scope,
    [...r.dependencies].sort(),
    [...r.actions].sort(),
    Object.entries(r.properties).sort(([a], [b]) => a.localeCompare(b)),
  ]);
export function compareInfrastructure(before, after) {
  if (before.format !== after.format)
    throw Error("같은 형식의 인프라 스냅샷을 선택해 주세요.");
  const previous = new Map(before.resources.map((r) => [r.id, r]));
  const changes = [];
  for (const r of after.resources) {
    const old = previous.get(r.id);
    if (!old) changes.push({ id: r.id, kind: "added" });
    else if (comparable(old) !== comparable(r))
      changes.push({ id: r.id, kind: "changed" });
    previous.delete(r.id);
  }
  for (const id of previous.keys()) changes.push({ id, kind: "removed" });
  return changes;
}
export function infrastructureMarkdown(value) {
  return (
    "## 리소스 목록\n\n" +
    sheetMarkdown({
      rows: [
        ["리소스", "종류", "범위", "계획 작업", "참조 대상"],
        ...value.resources.map((r) => [
          r.id,
          r.kind,
          r.scope,
          r.actions.join(", "),
          r.dependencies.join(", "),
        ]),
      ],
    }) +
    "\n\n## 운영 메모\n\n" +
    sheetMarkdown({
      rows: [["리소스", "메모"], ...Object.entries(value.notes || {})],
    })
  );
}
export const infrastructureExample = () => ({
  version: 1,
  format: "compose",
  source: "예제 compose.yaml",
  importedAt: new Date().toISOString(),
  warnings: ["예제 데이터입니다. 실제 인프라에 연결하지 않습니다."],
  notes: {},
  resources: [
    {
      id: "service:web",
      kind: "Service",
      name: "web",
      scope: "compose",
      dependencies: ["service:api", "network:default"],
      properties: { ports: "8080:80" },
      actions: [],
    },
    {
      id: "service:api",
      kind: "Service",
      name: "api",
      scope: "compose",
      dependencies: ["service:database", "network:default"],
      properties: { replicas: 2 },
      actions: [],
    },
    {
      id: "service:database",
      kind: "Service",
      name: "database",
      scope: "compose",
      dependencies: ["volume:database", "network:default"],
      properties: {},
      actions: [],
    },
    {
      id: "volume:database",
      kind: "Volume",
      name: "database",
      scope: "compose",
      dependencies: [],
      properties: {},
      actions: [],
    },
    {
      id: "network:default",
      kind: "Network",
      name: "default",
      scope: "compose",
      dependencies: [],
      properties: {},
      actions: [],
    },
  ],
});
export function infrastructureTemplate(type, resource) {
  const label = resource?.id || "인프라";
  if (type === "adr")
    return {
      title: "ADR · " + label,
      body: `# ADR · ${label}\n\n## 상태\n제안\n\n## 배경\n\n## 결정\n\n## 대안과 근거\n\n## 영향 및 되돌리기\n\n`,
    };
  return {
    title: "운영 절차 · " + label,
    body: `# 운영 절차 · ${label}\n\n## 담당자 · 환경\n\n## 목적과 의존성\n${(resource?.dependencies || []).map((d) => "- " + d).join("\n")}\n\n## 정상 상태 확인\n\n## 장애 진단\n\n## 복구 절차\n\n## 변경 전 확인 · 롤백\n\n## 마지막 검토\n\n`,
  };
}
