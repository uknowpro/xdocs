import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateArchitecture } from "../shared/architecture.mjs";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import { caseDiagram } from "../shared/case-diagrams.mjs";

const catalog = JSON.parse(
  await readFile(new URL("../catalog/case-studies.json", import.meta.url)),
);
for (const study of catalog)
  test(study.name + " preserves declarations and diagram targets", async () => {
    const m = JSON.parse(
      await readFile(
        new URL("../catalog/snapshots/" + study.id + ".json", import.meta.url),
      ),
    );
    const result = generateArchitecture(m, "terraform");
    assert.deepEqual(result.errors, []);
    const svg = caseDiagram(m);
    assert.equal(result.files["case-study.svg"], svg);
    const targets = [...svg.matchAll(/data-resource="([^"]+)"/g)].map(
      (x) => x[1],
    );
    assert.ok(targets.length >= 9);
    assert.ok(targets.every((id) => m.nodes.some((n) => n.id === id)));
    const files = m.sources.map((f) => ({
      name: f.name,
      content: result.files["terraform/" + f.name],
    }));
    assert.deepEqual(files, m.sources);
    const reparsed = await parseTerraformFiles(files);
    assert.deepEqual(
      reparsed.nodes.map((n) => [n.address, n.references]),
      m.nodes.map((n) => [n.address, n.references]),
    );
  });
