import { checkTerraform } from "../desktop/terraform-check.mjs";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import { generateArchitecture } from "../shared/architecture.mjs";
const output = new URL("../catalog/roundtrip-checks.json", import.meta.url);
const prior = JSON.parse(await readFile(output, "utf8").catch(() => "{}"));
const initialized = process.argv
  .find((arg) => arg.startsWith("--projects="))
  ?.slice(11);
const report = {};
for (const id of [
  "efs-backup-copy",
  "azure-isolated-spokes",
  "azure-quickstart-301-machine-learning-hub-spoke-secure",
  "gcp-regional-shared-egress",
  "dual-cloud-branches",
]) {
  const snapshot = JSON.parse(
    await readFile(
      new URL("../catalog/snapshots/" + id + ".json", import.meta.url),
      "utf8",
    ),
  );
  const project = await parseTerraformFiles(snapshot.sources);
  const output = generateArchitecture(project, "terraform");
  assert.deepEqual(output.errors, []);
  const files = project.sources.map(({ name }) => ({
    name,
    content: output.files["terraform/" + name],
  }));
  for (const f of snapshot.sources)
    assert.equal(output.files["terraform/" + f.name], f.content);
  const reread = await parseTerraformFiles(files);
  const graph = (m) =>
    m.nodes.map((n) => [n.address, n.references, n.scopeAddress]);
  assert.deepEqual(graph(project), graph(reread));
  report[id] = {
    files: files.length,
    resources: project.nodes.length,
    sha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
  };
  if (initialized) {
    const check = await checkTerraform(project, path.join(initialized, id));
    assert.ok(check.valid, JSON.stringify(check.diagnostics));
    report[id].validation = {
      tool: check.tool,
      warnings: [
        ...new Set(check.diagnostics.map((d) => d.message.split(" · ")[0])),
      ],
      count: check.diagnostics.length,
    };
  } else if (prior[id]?.sha256 === report[id].sha256 && prior[id]?.validation)
    report[id].validation = prior[id].validation;
}

if (process.argv.includes("--write"))
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
else assert.deepEqual(JSON.parse(await readFile(output, "utf8")), report);
