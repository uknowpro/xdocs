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

test("Helm origins use the rendered document index and keep ambiguous findings unresolved", async () => {
  const { helmOrigins, traceSources, readAnalyzerSource } =
    await import("../desktop/analyzer-source.mjs");
  const yaml = ["first", "second"]
    .map(
      (n) =>
        "---\n# Source: app/templates/" +
        n +
        ".yaml\nkind: Service\nmetadata: {name: same}\n",
    )
    .join("");
  const origins = helmOrigins(yaml);
  const raw = {
    findings: [{ file: "rendered.yaml", kind: "service", target: "same" }],
    connections: [
      {
        evidence: [
          { file: "rendered.yaml", reference: "documents[1].spec.ports[0]" },
        ],
      },
    ],
  };
  await traceSources(raw, ".", origins);
  assert.equal(raw.findings[0].source, undefined);
  const source = raw.connections[0].evidence[0].source;
  assert.equal(source.file, "templates/second.yaml");
  assert.equal(source.line, null);
  await assert.rejects(
    readAnalyzerSource({ ...source, file: "../package.json" }),
  );
});

test("path evidence follows the two endpoints even in a shared manifest", () => {
  const nodes=["Ingress","Service","Deployment"].map((kind,i)=>({
    kind,name:"web",file:"app.yaml",reference:"doc"+i,
  }));
  const evidence=nodes.map(n=>({file:n.file,reference:n.reference+".spec"}));
  const report=analyzerReport({connections:[{nodes,evidence,status:"declared"}]});
  assert.deepEqual(report.paths[0].edgeEvidence,[[0,1],[1,2]]);
});
