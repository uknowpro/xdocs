import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import {
  generateArchitecture,
  architectureEdges,
} from "../shared/architecture.mjs";
import { boundaryLayout } from "../shared/network-boundaries.mjs";
import { reassignPlacement } from "../shared/placement-edit.mjs";

test("Terraform graph comparison preserves dependency and containment through export", async () => {
  const content = await readFile(
    new URL("./fixtures/terraform-graph/main.tf", import.meta.url),
    "utf8",
  );
  const parse = (content) =>
    parseTerraformFiles([{ name: "main.tf", content }]);
  const exportRoot = (model) => {
    const result = generateArchitecture(model, "terraform");
    assert.deepEqual(result.errors, []);
    return result.files["terraform/main.tf"];
  };
  const model = await parse(content);
  const byAddress = (model, address) => {
    const node = model.nodes.find((item) => item.address === address);
    assert.ok(node, address);
    return node;
  };
  const parent = (model, address) => {
    const id = boundaryLayout(model).parents.get(byAddress(model, address).id);
    return model.nodes.find((item) => item.id === id)?.address;
  };
  assert.equal(model.nodes.length, 9);
  assert.equal(architectureEdges(model).length, 7);
  assert.equal(boundaryLayout(model).parents.size, 4);
  for (const name of ["direct", "repeated"])
    assert.equal(parent(model, "aws_instance." + name), "aws_subnet.app");
  assert.equal(
    byAddress(model, "aws_instance.repeated").multipleInstances,
    true,
  );
  for (const [name, references] of [
    ["variable", []],
    ["via_module", ["module.network"]],
    ["dependency_only", ["aws_subnet.app"]],
  ]) {
    assert.equal(parent(model, "aws_instance." + name), undefined);
    assert.deepEqual(
      byAddress(model, "aws_instance." + name).references,
      references,
    );
  }
  assert.deepEqual(byAddress(model, "module.network").references, [
    "aws_subnet.app",
  ]);
  assert.equal(
    byAddress(model, "aws_instance.variable").placementValue,
    "${var.subnet_id}",
  );
  assert.equal(
    byAddress(model, "aws_instance.via_module").placementValue,
    "${module.network.subnet_id}",
  );
  const direct = byAddress(model, "aws_instance.direct");
  direct.x += 100;
  assert.equal(exportRoot(model), content);
  const moved = reassignPlacement(
    model,
    direct,
    byAddress(model, "aws_subnet.destination"),
  );
  const exported = exportRoot(moved);
  const expected = content.replace(
    /(resource "aws_instance" "direct" \{[^}]*?subnet_id\s*=\s*)aws_subnet\.app\.id/,
    "$1aws_subnet.destination.id",
  );
  assert.notEqual(expected, content);
  assert.equal(exported, expected);
  const restored = await parse(exported);
  assert.equal(parent(restored, direct.address), "aws_subnet.destination");
  assert.equal(parent(restored, "aws_instance.repeated"), "aws_subnet.app");
});
