import {networkCases} from "../shared/network-case-layouts.mjs";
import { caseDiagram } from "../shared/case-diagrams.mjs";
import { boundaryLayout } from "../shared/network-boundaries.mjs";
import { firewallCase } from "../shared/azure-firewall-path.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  architectureCatalog,
  fromCatalog,
} from "../shared/architecture-catalog.mjs";
import { architectureEdges } from "../shared/architecture.mjs";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
const read = (name) =>
  readFile(new URL("../catalog/" + name, import.meta.url), "utf8");
const paths = JSON.parse(await read("reviewed-paths.json"));
const catalog = [
  ...JSON.parse(await read("case-studies.json")),
  ...JSON.parse(await read("sources.json")),
  ...architectureCatalog,
];
function check(id, model) {
  const byId = new Map(model.nodes.map((n) => [n.id, n.address || n.label]));
  const edges = architectureEdges(model).map((e) => [
    byId.get(e.source),
    byId.get(e.target),
  ]);
  for (const [source, target] of paths[id]) {
    assert.ok(
      edges.some(([a, b]) => a === source && b === target),
      id + " missing " + source + " → " + target,
    );
  }
}
test("every gallery card has a reviewed dependency in its shipped diagram", async () => {
  assert.deepEqual(Object.keys(paths).sort(), catalog.map((t) => t.id).sort());
  for (const t of catalog) {
    const m = architectureCatalog.some((a) => a.id === t.id)
      ? fromCatalog(t.id)
      : JSON.parse(await read("snapshots/" + t.id + ".json"));
    assert.ok(paths[t.id].length, t.id);
    if (t.id === firewallCase) m.caseStudyId = t.id;
    assert.equal(Boolean(t.cardOnly), !caseDiagram(m) && boundaryLayout(m).parents.size === 0, t.id + " gallery visibility");
    check(t.id, m);
  }
});
for (const [id, from, to] of [
  [
    "efs-backup-copy",
    "destination_vault_arn = aws_backup_vault.archive.arn",
    "destination_vault_arn = var.other_vault",
  ],
  [
    "azure-quickstart-301-nat-gateway-hub-spoke-firewall",
    "azurerm_firewall.main.ip_configuration[0].private_ip_address",
    "var.other_hop",
  ],
  [
    "batch-parity",
    "google_bigquery_routine.candidate",
    "google_bigquery_routine.legacy",
  ],
])
  test(
    id + " reports the missing dependency if its source is changed",
    async () => {
      const snap = JSON.parse(await read("snapshots/" + id + ".json"));
      check(id, await parseTerraformFiles(snap.sources));
      const modified = snap.sources.map((f) => ({
        ...f,
        content: f.content.replaceAll(from, to),
      }));
      assert.ok(modified.some((f, i) => f.content !== snap.sources[i].content));
      const model = await parseTerraformFiles(modified);
      assert.throws(() => check(id, model), new RegExp(id + " missing "));
    },
  );

test("batch cutover uses the candidate only for equivalent grouped results", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { parse } = await import("@cdktn/hcl2json");
  const source = await read("enterprise/batch-parity/main.tf");
  const parsed = await parse("main.tf", source);
  const sql =
    parsed.resource.google_bigquery_data_transfer_config.compare[0].params
      .query;
  // Execute the dialect-neutral comparison and publication SELECT from the shipped script.
  const comparison = sql.match(
    /SET differences = \((SELECT COUNT\(\*\) FROM baseline[^;]+)\);/,
  )[1];
  const publication = sql
    .match(/(SELECT batch_day,order_id,cents FROM trial[^;]+);/)[1]
    .replaceAll("batch_day", "$day")
    .replaceAll("differences", "$diff");
  for (const [trial, wantDifferences] of [
    [100, 0],
    [101, 1],
    [null, 1],
  ]) {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(
        "CREATE TABLE baseline(order_id TEXT,cents INTEGER); CREATE TABLE trial(order_id TEXT,cents INTEGER); INSERT INTO baseline VALUES ('order',100)",
      );
      if (trial !== null)
        db.prepare("INSERT INTO trial VALUES ('order',?)").run(trial);
      const [count] = Object.values(db.prepare(comparison).get());
      assert.equal(count, wantDifferences);
      const rows = db
        .prepare(publication)
        .all({ day: "2026-01-01", diff: count });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].cents, 100);
    } finally {
      db.close();
    }
  }
});

test("catalog exports retain reviewed addresses, module files, inputs and source locations on round trip", async () => {
  const { addressOf, catalogModel, inspect, terraformSources } =
    await import("../scripts/catalog-inspection.mjs");
  const inspection = JSON.parse(await read("inspection.json"));
  for (const { id } of catalog) {
    const model = await catalogModel(id);
    const files = terraformSources(model);
    const imported = await parseTerraformFiles(files);
    const after = terraformSources(imported);
    const byFile = (list) => new Map(list.map((f) => [f.name, f.content]));
    assert.deepEqual(
      byFile(after),
      byFile(files),
      id + " re-exported source files",
    );
    for (const f of model.sources)
      assert.equal(byFile(after).get(f.name), f.content, id + " " + f.name);
    const beforeNodes = new Map(
      model.nodes.map((n) => [n.address || n.label, addressOf(n)]),
    );
    const afterNodes = new Map(imported.nodes.map((n) => [n.id, n.address]));
    const edges = architectureEdges(imported).map((e) => [
      afterNodes.get(e.source),
      afterNodes.get(e.target),
    ]);
    for (const pair of paths[id]) {
      const [a, b] = pair.map((key) => beforeNodes.get(key));
      assert.ok(
        a && b && edges.some(([x, y]) => x === a && y === b),
        id + " round trip missing " + a + " → " + b,
      );
    }
    const inspected = await inspect(id, model);
    assert.ok(inspected.sites.length, id + " source location missing");
    assert.deepEqual(
      inspected,
      inspection[id],
      id + " catalog inspection needs regeneration",
    );
  }
});

test("network case drawings resolve every node, arrow and gallery reference against Terraform", async () => {
  for (const [id, spec] of Object.entries(networkCases)) {
    const model = JSON.parse(await read("snapshots/" + id + ".json"));
    const nodes = new Map(model.nodes.map(n => [n.address, n]));
    for (const [key] of spec.boxes) {
      if (key === "frame" || key.startsWith("step:")) continue;
      const node = nodes.get(key);
      assert.ok(node?.sourceFile && node.sourceLine, key);
    }
    for (const [a,b] of spec.links) assert.ok(nodes.get(a).references.includes(b), a+" → "+b);
    const [source,target] = paths[id][0];
    assert.ok(spec.links.some(([a,b]) => a === source && b === target), id);
  }
});
