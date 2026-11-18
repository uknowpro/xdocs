import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzerReport,
  analyzerMarkdown,
  readAnalyzerSettings,
  writeAnalyzerSettings,
  analyzerDefaults,
} from "../shared/analyzer.mjs";
import { analyzeDirectory } from "../desktop/analyzer.mjs";
test("Analyzer page settings preserve note content across updates", () => {
  let body = "# page\n<!-- xdocs:analyzer -->\n";
  body = writeAnalyzerSettings(body, {
    ...analyzerDefaults,
    namespace: "team",
  });
  body = writeAnalyzerSettings(body, {
    ...readAnalyzerSettings(body),
    mode: "helm-upgrade",
  });
  assert.equal(readAnalyzerSettings(body).namespace, "team");
  assert.equal(readAnalyzerSettings(body).mode, "helm-upgrade");
  assert.equal(body.split("xdocs-analyzer-settings").length, 2);
  assert.match(body, /^# page/);
});
test("Helm upgrade reports identify new and resolved findings", () => {
  const f = {
    rule_id: "API",
    resource: "CronJob",
    field: "apiVersion",
    message: "check",
  };
  const report = analyzerReport({
    kind: "helm-upgrade",
    from: "1.24",
    to: "1.25",
    before: { findings: [{ ...f, severity: "warning" }] },
    report: {
      target_version: "1.25",
      findings: [{ ...f, severity: "error" }],
      unchecked: ["custom schema"],
    },
  });
  assert.deepEqual(
    report.rows.map((r) => r[0]),
    ["error", "업그레이드 조치", "이전 버전에만 발생"],
  );
  assert.match(analyzerMarkdown(report), /custom schema/);
});
test("Analyzer rejects invalid versions before invoking CLI", async () => {
  await assert.rejects(
    analyzeDirectory(".", { mode: "upgrade", from: "1.28", to: "1.25" }),
    /시작 버전/,
  );
  assert.throws(() => analyzerReport({ other: "report" }), /JSON/);
});
