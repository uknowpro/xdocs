export const analyzerMarker = "<!-- xdocs:analyzer -->";
const configBlock = /^```xdocs-analyzer-settings\r?\n([^]*?)\r?\n```$/m;
export const analyzerDefaults = {
  mode: "network",
  from: "1.24",
  to: "1.25",
  release: "app",
  namespace: "default",
  customValues: false,
};
export function readAnalyzerSettings(body) {
  let saved = {};
  try {
    saved = JSON.parse(body.match(configBlock)?.[1] || "{}");
  } catch {}
  return Object.fromEntries(
    Object.entries(analyzerDefaults).map(([k, v]) => [
      k,
      typeof saved?.[k] === typeof v ? saved[k] : v,
    ]),
  );
}
export function writeAnalyzerSettings(body, settings) {
  const block =
    "```xdocs-analyzer-settings\n" +
    JSON.stringify(settings).replaceAll("`", "\\u0060") +
    "\n```";
  return configBlock.test(body)
    ? body.replace(configBlock, () => block)
    : body.trimEnd() + "\n\n" + block + "\n";
}
const str = (x) =>
  typeof x === "string" || typeof x === "number" ? String(x) : "";
const list = (x) => (Array.isArray(x) ? x : []);
export function analyzerReport(raw) {
  if (!raw || typeof raw !== "object") throw Error("분석 JSON을 확인하세요.");
  const network =
    Array.isArray(raw.connections) ||
    (raw.project && Array.isArray(raw.findings));
  const report = network ? raw : raw.report || raw;
  if (
    !network &&
    !(
      report.target_version &&
      ("findings" in report || "documents" in report)
    ) &&
    raw.kind !== "upgrade"
  )
    throw Error(
      "netspector scan 또는 kubewiser scan·upgrade JSON이 필요합니다.",
    );
  const rows = list(report.findings).map((f) =>
    network
      ? [
          str(f.direction),
          [f.kind, f.target, f.port].map(str).filter(Boolean).join(" · "),
          str(f.status),
          [f.file, f.line || f.reference].map(str).filter(Boolean).join(":"),
        ]
      : [
          str(f.severity),
          [f.rule_id, f.resource].map(str).filter(Boolean).join(" · "),
          str(f.message),
          [f.file, f.line || f.field].map(str).filter(Boolean).join(":"),
        ],
  );
  for (const a of list(raw.actions))
    rows.push(["업그레이드 조치", str(a.id), str(a.message), str(a.resource)]);
  const paths = list(raw.connections).map((c) => ({
    status: str(c.status),
    nodes: list(c.nodes).map((n) =>
      [n.namespace, n.kind, n.name, n.port]
        .map(str)
        .filter(Boolean)
        .join(" / "),
    ),
    evidence: list(c.evidence).map((e) =>
      [e.file, e.line || e.reference].map(str).filter(Boolean).join(":"),
    ),
  }));
  if (network && paths.length === 0) {
    for (const f of list(report.findings)) {
      if (
        !f.file ||
        !f.target ||
        !["inbound", "outbound"].includes(f.direction)
      )
        continue;
      const origin = str(f.file),
        target = str(f.target);
      paths.push({
        status: [str(f.direction), str(f.status)].filter(Boolean).join(" · "),
        nodes: f.direction === "inbound" ? [target, origin] : [origin, target],
        evidence: [[origin, f.line || f.reference].filter(Boolean).join(":")],
      });
    }
  }
  if (raw.kind === "helm-upgrade") {
    const signature = (f) =>
      JSON.stringify([f.rule_id, f.resource, f.field, f.severity, f.message]);
    const before = new Set(list(raw.before?.findings).map(signature)),
      after = new Set(list(report.findings).map(signature));
    for (const f of list(report.findings))
      if (!before.has(signature(f)))
        rows.push([
          "업그레이드 조치",
          str(f.rule_id),
          str(f.message),
          str(f.resource),
        ]);
    for (const f of list(raw.before?.findings))
      if (!after.has(signature(f)))
        rows.push([
          "이전 버전에만 발생",
          str(f.rule_id),
          str(f.message),
          str(f.resource),
        ]);
  }
  const notes = [
    ...list(report.unchecked),
    ...list(raw.before?.unchecked).map((x) => "시작 버전 · " + x),
    ...list(raw === report ? null : raw.unchecked),
    ...list(raw.diagnostics),
  ].map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
  return {
    title: network
      ? "네트워크 분석"
      : raw.kind === "helm-upgrade"
        ? "Helm 업그레이드"
        : raw.kind === "upgrade"
          ? "Kubernetes 업그레이드"
          : "Kubernetes 호환성",
    version: [str(raw.from), str(raw.to || report.target_version)]
      .filter(Boolean)
      .join(" → "),
    rules: str(report.rules_version),
    steps: list(raw.steps).map(str),
    rows,
    paths,
    notes,
  };
}
export function analyzerMarkdown(r) {
  const safe = (x) =>
    String(x)
      .replace(/[\r\n]+/g, " ")
      .replaceAll("<", "&lt;")
      .replaceAll("[", "&#91;")
      .replaceAll("!", "&#33;");
  return [
    "# " + r.title,
    r.version,
    r.rules && "규칙 " + r.rules,
    ...r.steps.map((x) => "단계 · " + safe(x)),
    "## 네트워크 경로",
    ...r.paths.flatMap((p) => [
      "- " + p.nodes.map(safe).join(" → ") + " · " + safe(p.status),
      ...p.evidence.map((e) => "  - " + safe(e)),
    ]),
    "## 발견 및 조치",
    ...r.rows.map((row) => "- " + row.map(safe).filter(Boolean).join(" · ")),
    "## 검사 범위 및 진단",
    ...r.notes.map((x) => "- " + safe(x)),
  ]
    .filter(Boolean)
    .join("\n");
}
