import test from "node:test";
import assert from "node:assert/strict";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import {
  generateArchitecture,
  architectureExample,
  architectureEdges,
  encodeArchitecture,
  decodeArchitecture,
} from "../shared/architecture.mjs";
import { boundaryLayout, boundarySVG } from "../shared/network-boundaries.mjs";
import { canPlace, reassignPlacement } from "../shared/placement-edit.mjs";
for (const json of [false, true])
  test(
    "direct placement preserves other occurrences and reimports " +
      (json ? "JSON" : "HCL"),
    async () => {
      const resource = {
        aws_subnet: { a: {}, destination: {} },
        aws_instance: {
          one: {
            subnet_id: "${aws_subnet.a.id}",
            depends_on: ["aws_subnet.a"],
          },
          two: { subnet_id: "${aws_subnet.a.id}" },
          dynamic: { subnet_id: "${var.subnet}" },
        },
      };
      const content = json
        ? JSON.stringify({ resource }, null, 2)
        : '# aws_subnet.a.id\nresource "aws_subnet" "a" {}\nresource "aws_subnet" "destination" {}\nresource "aws_instance" "one" {\n subnet_id = aws_subnet.a.id # aws_subnet.a.id\n depends_on=[aws_subnet.a]\n}\nresource "aws_instance" "two" { subnet_id = aws_subnet.a.id }\nresource "aws_instance" "dynamic" { subnet_id=var.subnet }\n';
      const name = json ? "main.tf.json" : "main.tf";
      let m = await parseTerraformFiles([{ name, content }]);
      const node = (address) => m.nodes.find((n) => n.address === address);
      const dest = node("aws_subnet.destination");
      assert.ok(!canPlace(m, node("aws_instance.dynamic"), dest));
      for (const child of ["one", "two"])
        m = reassignPlacement(m, node("aws_instance." + child), dest);
      assert.ok(node("aws_instance.one").references.includes("aws_subnet.a"));
      const result = generateArchitecture(m, "terraform");
      assert.deepEqual(result.errors, []);
      const after = result.files["terraform/" + name];
      assert.equal(
        after,
        json
          ? content.replaceAll(
              '"${aws_subnet.a.id}"',
              '"${aws_subnet.destination.id}"',
            )
          : content.replaceAll(
              "subnet_id = aws_subnet.a.id",
              "subnet_id = aws_subnet.destination.id",
            ),
      );
      const re = await parseTerraformFiles([{ name, content: after }]);
      assert.equal(
        re.nodes.filter((n) => n.scopeAddress === dest.address).length,
        2,
      );
    },
  );
test("presentation round trips, projects collapsed edges and never changes IaC", () => {
  const m = architectureExample(),
    vpc = m.nodes.find((n) => n.kind === "aws_vpc"),
    sub = m.nodes.find((n) => n.kind === "aws_subnet"),
    vm = m.nodes.find((n) => n.kind === "aws_instance");
  const view = {
    ...m,
    presentation: {
      folded: [sub.id],
      locked: [vm.id],
      annotations: { [sub.id]: "운영 메모" },
      refs: true,
      resources: false,
      notes: true,
    },
  };
  assert.deepEqual(decodeArchitecture(encodeArchitecture(view)), view);
  assert.equal(boundaryLayout(view).representatives.get(vm.id), sub.id);
  assert.ok(!canPlace(view, vm, sub));
  assert.match(
    boundarySVG(view, vpc.id, architectureEdges(view)),
    /접힘 · 1개/,
  );
  const a = generateArchitecture(m),
    b = generateArchitecture(view);
  for (const f of Object.keys(a.files).filter((f) =>
    /^(terraform|cloudformation|chart|manifests)\//.test(f),
  ))
    assert.equal(b.files[f], a.files[f]);
});

for (const [cloud, network, subnet, field, attribute] of [
  ["AWS", "aws_vpc", "aws_subnet", "vpc_id", "id"],
  [
    "Azure",
    "azurerm_virtual_network",
    "azurerm_subnet",
    "virtual_network_name",
    "name",
  ],
  [
    "GCP",
    "google_compute_network",
    "google_compute_subnetwork",
    "network",
    "self_link",
  ],
]) {
  test(
    cloud +
      " edited subnet, module input and canvas annotation survive their exports",
    async () => {
      const source = [
        'resource "' + network + '" "old" {}',
        'resource "' + network + '" "new" {}',
        'resource "' +
          subnet +
          '" "app" { ' +
          field +
          " = " +
          network +
          ".old." +
          attribute +
          " }",
        'module "consumer" {\n source = "./consumer"\n subnet = ' +
          subnet +
          ".app.id\n}",
      ].join("\n");
      const files = [
        { name: "main.tf", content: source },
        {
          name: "consumer/main.tf",
          content:
            'variable "subnet" {}\noutput "selected" { value = var.subnet }',
        },
      ];
      const model = await parseTerraformFiles(files);
      const child = model.nodes.find((n) => n.address === subnet + ".app");
      const target = model.nodes.find((n) => n.address === network + ".new");
      const moved = reassignPlacement(model, child, target);
      moved.presentation = {
        annotationLinks: [
          { source: child.id, target: target.id, label: "운영 경계" },
        ],
      };
      const generated = generateArchitecture(moved, "terraform");
      assert.deepEqual(generated.errors, []);
      assert.deepEqual(
        JSON.parse(generated.files["architecture.json"]).presentation,
        moved.presentation,
      );
      const exported = files.map((f) => ({
        name: f.name,
        content: generated.files["terraform/" + f.name],
      }));
      assert.equal(
        exported[0].content,
        source.replace(
          network + ".old." + attribute,
          network + ".new." + attribute,
        ),
      );
      assert.equal(exported[1].content, files[1].content);
      const restored = await parseTerraformFiles(exported);
      assert.equal(
        restored.nodes.find((n) => n.address === child.address).scopeAddress,
        target.address,
      );
      assert.ok(
        restored.nodes
          .find((n) => n.address === "module.consumer")
          .references.includes(child.address),
      );
      const reverted = reassignPlacement(
        restored,
        restored.nodes.find(n => n.address === child.address),
        restored.nodes.find(n => n.address === network + ".old"),
      );
      const roundTrip = generateArchitecture(reverted, "terraform");
      assert.deepEqual(roundTrip.errors, []);
      for (const {name, content} of files) assert.equal(roundTrip.files["terraform/" + name], content);
    },
  );
}
