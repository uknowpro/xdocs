import test from "node:test";
import assert from "node:assert/strict";
import { reviewPlan, planNode } from "../shared/plan-review.mjs";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";

test("AWS, Azure and GCP plan actions preserve exact instance addresses, redact both sides and flag unknown values", () => {
  const addresses = [
    "aws_instance.web[0]",
    "azurerm_subnet.apps",
    "google_compute_network.vpc",
  ];
  for (const [i, address] of addresses.entries()) {
    const actions = [["delete", "create"], ["update"], ["create"]][i];
    const change = {
      actions,
      before: { nested: [{ password: "old-secret" }], port: 80 },
      after: { nested: [{ password: "new-secret" }], port: null },
      before_sensitive: { nested: [{ password: true }] },
      after_unknown: { port: true },
    };
    const [row] = reviewPlan({
      format_version: "1.2",
      resource_changes: [{ address, change }],
    });
    assert.equal(row.action, ["교체", "수정", "생성"][i]);
    assert.equal(row.address, address);
    assert.ok(!JSON.stringify(row).includes("secret"));
    assert.equal(
      row.fields.find((f) => f.key === "port").after,
      "적용 후 결정",
    );
    const n = { id: "n_a", address: address.split("[")[0] };
    assert.equal(planNode(address, [n]), n.id);
    assert.equal(planNode("module.team." + address, [n]), undefined);
  }
  assert.throws(() => reviewPlan({ format_version: "1.0", values: {} }));
  assert.throws(() =>
    reviewPlan({ format_version: "2.0", resource_changes: [] }),
  );
  assert.deepEqual(
    reviewPlan({ format_version: "1.2", planned_values: {} }),
    [],
  );
});
test("file coverage keeps variables and unresolved dependency addresses alongside editable resources", async () => {
  const m = await parseTerraformFiles([
    {
      name: "main.tf",
      content:
        'variable "env" {}\nresource "aws_vpc" "app" {\n cidr_block = "10.0.0.0/16"\n depends_on = [aws_subnet.missing]\n}',
    },
  ]);
  assert.ok(m.sources[0].preservedDeclarations.includes("variable.env"));
  assert.deepEqual(m.nodes[0].unresolvedReferences, ["aws_subnet.missing"]);
  assert.equal(m.nodes[0].props.cidr, "10.0.0.0/16");
});
