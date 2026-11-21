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

test("extended providers use their own addresses, provider bindings and ARM API versions", () => {
  const m = newArchitecture();
  for (const kind of ["awscc_s3_bucket", "azuread_group", "arm_microsoft.storage/storageaccounts", "beta_google_compute_network", "service_aws__custom"]) {
    m.nodes.push(newComponent(kind));
  }
  const result = generateArchitecture(decodeArchitecture(encodeArchitecture(m)), "terraform");
  assert.deepEqual(result.errors, []);
  const tf = JSON.parse(result.files["terraform/main.tf.json"]);
  assert.deepEqual(Object.keys(tf.provider).sort(), ["awscc","azapi","azuread","google-beta"]);
  assert.match(tf.resource.azapi_resource[m.nodes[2].id].type, /^Microsoft.Storage\/storageAccounts@/);
  assert.equal(tf.resource.google_compute_network[m.nodes[3].id].provider, "google-beta");
  assert.equal(Object.keys(tf.resource).length, 4);
  assert.ok(result.warnings.some(w => w.includes("서비스 도식 1개")));
});

test("all seven provider schemas and every ARM type have a selectable component", async () => {
  const { default: inventory } = await import("../shared/cloud-inventory.mjs");
  for (const [provider, types] of Object.entries(inventory.managed)) {
    for (const type of types) {
      const kind = provider === "google-beta" ? "beta_" + type : type;
      const component = allComponents[kind];
      assert.ok(component && !component.documentationOnly && !component.diagramOnly, kind);
      assert.equal(component.terraformType || kind, type);
    }
  }
  for (const type of inventory.armTypes) {
    const node = newComponent("arm_" + type.split("@")[0].toLowerCase());
    assert.equal(JSON.parse(node.props.arguments).type, type);
  }
});
