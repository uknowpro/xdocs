import test from "node:test";
import assert from "node:assert/strict";
import {
  newComponent,
  newArchitecture,
  architectureEdges,
  generateArchitecture,
  architectureIssues,
} from "../shared/architecture.mjs";
import { resourceSchema, fieldProblems } from "../shared/resource-form.mjs";
import { reassignPlacement } from "../shared/placement-edit.mjs";
import { boundaryLayout } from "../shared/network-boundaries.mjs";
import { declarationLines } from "../shared/declaration-lines.mjs";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
for (const [kind, parentKind, attribute] of [
  ["aws_security_group", "aws_vpc", "vpc_id"],
  ["azurerm_availability_set", "azurerm_resource_group", "resource_group_name"],
  ["google_compute_firewall", "google_compute_network", "network"],
]) {
  test(
    kind +
      " binds a real schema attribute, exports its parent, and maps code to canvas",
    () => {
      const parent = newComponent(parentKind),
        child = newComponent(kind),
        model = newArchitecture();
      model.nodes = [parent, child];
      const moved = reassignPlacement(model, child, parent);
      assert.equal(boundaryLayout(moved).parents.get(child.id), parent.id);
      assert.ok(
        architectureEdges(moved).some(
          (e) => e.target === parent.id && e.field === attribute,
        ),
      );
      const out = generateArchitecture(moved, "terraform", [child.id]);
      assert.deepEqual(out.errors, []);
      const source = out.files["terraform/main.tf.json"];
      assert.ok(
        JSON.parse(source).resource[kind][child.id][attribute].includes(
          parent.id,
        ),
      );
      assert.ok(
        [
          ...declarationLines(
            source,
            "terraform/main.tf.json",
            moved.nodes,
          ).values(),
        ].includes(child.id),
      );
      assert.ok(
        architectureIssues({ ...moved, nodes: moved.nodes.slice(1) }).some(
          (i) => i.message.includes(attribute),
        ),
      );
    },
  );
}
test("schema forms diagnose required, primitive and nested values without modifying expressions", () => {
  assert.ok(
    fieldProblems(resourceSchema("azuread_group").fields, {}).some((x) =>
      x.includes("display_name"),
    ),
  );
  assert.equal(
    fieldProblems({ value: [["list", "number"], true] }, { value: [1, "bad"] })
      .length,
    1,
  );
  assert.deepEqual(
    fieldProblems({ value: ["number", true] }, { value: "${var.amount}" }),
    [],
  );
});
test("aliases, indexed declarations and local modules round trip without evaluation", async () => {
  const files = [
    {
      name: "main.tf",
      content:
        'provider "aws" { alias = "dr" }\nresource "aws_vpc" "net" {\n provider=aws.dr\n for_each=var.networks\n cidr_block=each.value\n}\nmodule "child" {\n source="./child"\n count=var.replicas\n providers={aws=aws.dr}\n}\n',
    },
    {
      name: "child/main.tf",
      content: 'resource "aws_s3_bucket" "archive" {}\n',
    },
  ];
  const m = await parseTerraformFiles(files);
  const exported = generateArchitecture(m, "terraform");
  assert.deepEqual(exported.errors, []);
  for (const f of files)
    assert.equal(exported.files["terraform/" + f.name], f.content);
});

test("new canvases pin providers and old canvases keep their constraints until reviewed", async () => {
  const { catalogSettings } = await import("../shared/architecture.mjs");
  const m = newArchitecture();
  m.nodes.push(newComponent("aws_vpc"));
  const version = () =>
    JSON.parse(
      generateArchitecture(m, "terraform").files["terraform/main.tf.json"],
    ).terraform.required_providers.aws.version;
  assert.equal(version(), catalogSettings().provider_aws);
  delete m.settings.provider_aws;
  assert.equal(version(), "~> 6.0");
  Object.assign(m.settings, catalogSettings());
  assert.equal(version(), catalogSettings().provider_aws);
});

test("a schema update identifies changed fields and retains removed types for old canvases", async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const root = await mkdtemp(path.join(tmpdir(), "xinfra-schema-test-"));
  try {
    const input = path.join(root, "input.json"),
      output = path.join(root, "snapshot.mjs");
    async function compile(resources) {
      await writeFile(
        input,
        JSON.stringify({
          provider_schemas: {
            "registry.terraform.io/hashicorp/aws": {
              resource_schemas: resources,
            },
          },
        }),
      );
      execFileSync("python3", [
        "scripts/compile-resource-schema.py",
        input,
        output,
      ]);
    }
    const sample = (type) => ({
      block: { attributes: { size: { type, required: true } } },
    });
    await compile({ aws_example: sample("number"), aws_old: sample("string") });
    await compile({ aws_example: sample("string"), aws_new: sample("number") });
    const report = JSON.parse(
      (await readFile(path.join(root, "schema-changes.mjs"), "utf8"))
        .split("export default ")[1]
        .trim()
        .slice(0, -1),
    );
    assert.deepEqual(report.added, ["aws_new"]);
    assert.deepEqual(report.retired, ["aws_old"]);
    assert.deepEqual(report.changes.aws_example.changed, ["size"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
