import test from "node:test";
import assert from "node:assert/strict";
import { providerCatalog } from "../shared/provider-catalog.mjs";
import { allComponents, newArchitecture, newComponent, generateArchitecture, encodeArchitecture, decodeArchitecture } from "../shared/architecture.mjs";

test("every registry resource is independently placeable under its provider", () => {
  for (const [group, snapshot] of Object.entries(providerCatalog)) {
    const kinds = Object.values(snapshot.services).flat();
    assert.equal(new Set(kinds).size, kinds.length);
    for (const kind of kinds) {
      assert.equal(allComponents[kind].group, group);
      assert.equal(newComponent(kind).kind, kind);
    }
  }
});

test("provider-specific resources preserve nested Terraform arguments across save and export", () => {
  const model = newArchitecture();
  const args = { count: 2, tags: { owner: "ops" } };
  for (const kind of ["aws_lambda_function", "azurerm_kubernetes_cluster", "google_cloud_run_v2_service", "aws_lambda_function"]) {
    const node = newComponent(kind);
    node.props.arguments = JSON.stringify(args);
    model.nodes.push(node);
  }
  const result = generateArchitecture(decodeArchitecture(encodeArchitecture(model)), "terraform");
  assert.deepEqual(result.errors, []);
  const tf = JSON.parse(result.files["terraform/main.tf.json"]);
  for (const n of model.nodes) assert.deepEqual(tf.resource[n.kind][n.id], args);
  assert.ok(generateArchitecture(model, "cloudformation").errors.length);
  model.nodes[0].props.arguments = "[]";
  assert.ok(generateArchitecture(model, "terraform").errors.length);
});
