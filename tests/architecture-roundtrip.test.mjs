import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import {
  generateArchitecture,
  architectureIssues,
  newArchitecture,
  newComponent,
} from "../shared/architecture.mjs";
import { planModuleTarget, reviewPlan } from "../shared/plan-review.mjs";

for (const [study, address, field, value, attribute] of [
  [
    "organization-audit",
    "aws_subnet.zone_a",
    "cidr",
    "10.72.12.0/24",
    "cidr_block",
  ],
  [
    "regional-app-dr",
    "azurerm_resource_group.primary",
    "location",
    "koreasouth",
    "location",
  ],
  [
    "gcp-regional-shared-egress",
    "google_compute_router.seoul",
    "name",
    "regional-egress",
    "name",
  ],
])
  test(
    study +
      " preserves enterprise sources and module bindings through an edited round trip",
    async () => {
      const snapshot = JSON.parse(
        await readFile(
          new URL("../catalog/snapshots/" + study + ".json", import.meta.url),
          "utf8",
        ),
      );
      const [kind, name] = address.split(".");
      const sources = [
        ...snapshot.sources,
        {
          name: "audit.tf",
          content:
            'module "audit" {\n source = "./modules/audit"\n input = ' +
            address +
            ".id\n}",
        },
        {
          name: "modules/audit/main.tf",
          content:
            'variable "input" {}\noutput "resource_id" { value = var.input }',
        },
      ];
      const model = await parseTerraformFiles(sources);
      const graph = (m) =>
        m.nodes.map((n) => [n.address, n.references, n.scopeAddress]);
      const before = graph(model);
      model.nodes.find((n) => n.address === address).props[field] = value;
      const exported = generateArchitecture(model, "terraform");
      assert.deepEqual(exported.errors, []);
      const files = Object.entries(exported.files)
        .filter(([key]) => key.startsWith("terraform/"))
        .map(([key, content]) => ({ name: key.slice(10), content }));
      assert.equal(files.length, sources.length + 1);
      for (const f of sources)
        assert.equal(files.find((s) => s.name === f.name).content, f.content);
      const overlay = files.find((f) => f.name === "zz_xdocs_override.tf.json");
      assert.deepEqual(JSON.parse(overlay.content), {
        resource: { [kind]: { [name]: { [attribute]: value } } },
      });
      const restored = await parseTerraformFiles(files);
      assert.equal(
        restored.nodes.find((n) => n.address === address).props[field],
        value,
      );
      assert.deepEqual(graph(restored), before);
      assert.deepEqual(
        generateArchitecture(restored, "terraform").files,
        exported.files,
      );
    },
  );

test("indexed module instances resolve to the owning call and its exact local declaration", async () => {
  const model = await parseTerraformFiles([
    {
      name: "main.tf",
      content:
        'module "net" {\n source = "./modules/net"\n for_each = toset(["prod","dev"])\n}\nresource "aws_subnet" "app" {}',
    },
    {
      name: "modules/net/subnets.tf",
      content:
        '# resource "aws_subnet" "wrong" {}\nresource "aws_subnet" "app" {}',
    },
  ]);
  const row = (address) =>
    reviewPlan({
      format_version: "1.0",
      resource_changes: [{ address, change: { actions: ["update"] } }],
    })[0];
  for (const key of ["prod", "dev", "a.b]"]) {
    const r = row("module.net[" + JSON.stringify(key) + "].aws_subnet.app[0]");
    const target = planModuleTarget(r, model);
    assert.equal(target.address, "module.net");
    assert.equal(target.file, "modules/net/subnets.tf");
    assert.equal(model.sources[1].declarationLines[r.declaration], 2);
  }
  assert.equal(
    planModuleTarget(row("module.net.module.nested.aws_subnet.app"), model)
      .file,
    undefined,
  );
  assert.equal(
    planModuleTarget(row("module.other.aws_subnet.app"), model),
    undefined,
  );
});

for (const [net, sub, ref] of [
  ["aws_vpc", "aws_subnet", "vpc"],
  ["azurerm_virtual_network", "azurerm_subnet", "network"],
  ["google_compute_network", "google_compute_subnetwork", "network"],
])
  test(
    sub +
      " canvas reports both overlapping nodes and clears on edit or reassignment",
    () => {
      const m = newArchitecture(),
        v = newComponent(net),
        isolated = newComponent(net),
        a = newComponent(sub),
        b = newComponent(sub);
      m.nodes = [v, isolated, a, b];
      a.props[ref] = b.props[ref] = v.id;
      a.props.cidr = "10.0.1.0/24";
      b.props.cidr = "10.0.1.128/25";
      const conflicts = () =>
        architectureIssues(m)
          .filter((i) => i.message.includes("CIDR 충돌"))
          .map((i) => i.id)
          .sort();
      assert.deepEqual(conflicts(), [a.id, b.id].sort());
      b.props[ref] = isolated.id;
      assert.deepEqual(conflicts(), []);
      b.props[ref] = v.id;
      b.props.cidr = "10.0.2.0/24";
      assert.deepEqual(conflicts(), []);
    },
  );
