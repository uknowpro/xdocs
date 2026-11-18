import { reassignPlacement } from "../shared/placement-edit.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import {
  generateArchitecture,
  architectureEdges,
  encodeArchitecture,
  decodeArchitecture,
} from "../shared/architecture.mjs";
import { boundaryLayout, canPlace } from "../shared/network-boundaries.mjs";

const load = (cloud) =>
  readFile(
    new URL(
      "./fixtures/indexed-placement/" + cloud + "/main.tf",
      import.meta.url,
    ),
    "utf8",
  );
const parse = (content) => parseTerraformFiles([{ name: "main.tf", content }]);
function parent(model, child) {
  const id = boundaryLayout(model).parents.get(child.id);
  return model.nodes.find((node) => node.id === id)?.address;
}
function exportRoot(model) {
  const result = generateArchitecture(model, "terraform");
  assert.deepEqual(result.errors, []);
  return result.files["terraform/main.tf"];
}
for (const [cloud, resource, subnet] of [
  ["aws", "aws_instance.app", "aws_subnet.app"],
  [
    "gcp",
    "google_compute_instance.per_key",
    "google_compute_subnetwork.per_key",
  ],
  ["azure", "azurerm_network_interface.per_key", "azurerm_subnet.app"],
]) {
  test(
    cloud + " indexed placement survives diagram save and Terraform reimport",
    async () => {
      const content = await load(cloud);
      const saved = decodeArchitecture(
        encodeArchitecture(await parse(content)),
      );
      assert.equal(exportRoot(saved), content);
      for (const model of [saved, await parse(exportRoot(saved))]) {
        const find = (a) => model.nodes.find((n) => n.address === a);
        const child = find(resource),
          group = find(subnet);
        const edge = architectureEdges(model).find(
          (e) => e.source === child.id && e.target === group.id,
        );
        assert.equal(edge?.label, "선언 참조 · each.key");
        assert.equal(parent(model, child), undefined);
        assert.equal(canPlace(model, child, group), false);
        if (cloud === "azure") {
          for (const [child, parentAddress] of [
            ["azurerm_virtual_network.main", "azurerm_resource_group.main"],
            ["azurerm_subnet.fixed", "azurerm_virtual_network.main"],
            ["azurerm_network_interface.fixed", "azurerm_subnet.fixed"],
            ["azurerm_linux_virtual_machine.app", "azurerm_subnet.fixed"],
          ])
            assert.equal(parent(model, find(child)), parentAddress);
        }
      }
    },
  );
}
test("Azure multi-NIC, multiple IP configurations and indexed NIC preserve ambiguity", async () => {
  const base = await load("azure");
  const vm = "azurerm_linux_virtual_machine.app";
  for (const [content, expectedLabel] of [
    [
      base.replace(
        "[azurerm_network_interface.fixed.id]",
        '[azurerm_network_interface.fixed.id, azurerm_network_interface.per_key["blue"].id]',
      ),
      undefined,
    ],
    [
      base
        .replace(
          'resource "azurerm_linux_virtual_machine" "app" {',
          'resource "azurerm_linux_virtual_machine" "app" {\n for_each = local.prefixes',
        )
        .replace(
          "[azurerm_network_interface.fixed.id]",
          "[azurerm_network_interface.per_key[each.key].id]",
        ),
      "선언 참조 · each.key",
    ],
    [
      base.replace(
        /(resource "azurerm_network_interface" "fixed" \{)/,
        '$1\n ip_configuration {\n name="secondary"\n private_ip_address_allocation="Dynamic"\n subnet_id=azurerm_subnet.app["blue"].id\n }',
      ),
      undefined,
    ],
  ]) {
    const model = await parse(content);
    const app = model.nodes.find((n) => n.address === vm);
    assert.equal(parent(model, app), undefined);
    const indexed = architectureEdges(model).filter(
      (e) => e.source === app.id && e.label,
    );
    assert.deepEqual(
      indexed.map((e) => e.label),
      expectedLabel ? [expectedLabel] : [],
    );
    assert.equal(exportRoot(model), content);
  }
});

test("Azure Windows VM follows a fixed NIC and dynamic IP blocks keep subnet unresolved", async () => {
  const content = (await load("azure")).replace(
    'resource "azurerm_linux_virtual_machine"',
    'resource "azurerm_windows_virtual_machine"',
  );
  const address = "azurerm_windows_virtual_machine.app";
  const readParent = (model) =>
    parent(
      model,
      model.nodes.find((n) => n.address === address),
    );
  assert.equal(readParent(await parse(content)), "azurerm_subnet.fixed");
  const dynamic = content.replace(
    'resource "azurerm_network_interface" "fixed" {',
    'resource "azurerm_network_interface" "fixed" {\n dynamic "ip_configuration" {\n for_each = local.prefixes\n content { subnet_id = azurerm_subnet.app[ip_configuration.key].id }\n }',
  );
  const model = await parse(dynamic);
  assert.equal(readParent(model), undefined);
  assert.equal(exportRoot(model), dynamic);
});

test("GCP VPC, subnet and NIC evidence survive HCL and a saved canvas", async () => {
  const content = await load("gcp");
  const model = decodeArchitecture(encodeArchitecture(await parse(content)));
  const find = (address) => model.nodes.find((n) => n.address === address);
  const fixed = find("google_compute_instance.fixed"),
    multi = find("google_compute_instance.multi");
  assert.equal(parent(model, fixed), "google_compute_subnetwork.app");
  assert.equal(
    parent(model, find("google_compute_subnetwork.app")),
    "google_compute_network.app",
  );
  assert.equal(parent(model, multi), undefined);
  assert.deepEqual(multi.references.toSorted(), [
    "google_compute_subnetwork.app",
    "google_compute_subnetwork.ops",
  ]);
  assert.deepEqual(multi.interfaceEvidence, [
    'network_interface[0].subnetwork = "${google_compute_subnetwork.app.self_link}"',
    'network_interface[1].subnetwork = "${google_compute_subnetwork.ops.self_link}"',
  ]);
  const moved = reassignPlacement(
    model,
    fixed,
    find("google_compute_subnetwork.ops"),
  );
  const exported = exportRoot(moved);
  assert.equal(
    exported,
    content.replace(
      "google_compute_subnetwork.app.self_link",
      "google_compute_subnetwork.ops.self_link",
    ),
  );
  const restored = await parse(exported);
  assert.equal(
    parent(
      restored,
      restored.nodes.find((n) => n.address === fixed.address),
    ),
    "google_compute_subnetwork.ops",
  );
  assert.deepEqual(
    restored.nodes.find((n) => n.address === multi.address).interfaceEvidence,
    multi.interfaceEvidence,
  );
});
test("GCP dynamic NICs keep subnet membership unresolved", async () => {
  const content = (await load("gcp")).replace(
    'resource "google_compute_instance" "fixed" {',
    'resource "google_compute_instance" "fixed" {\n dynamic "network_interface" {\n for_each = local.ranges\n content { subnetwork = google_compute_subnetwork.per_key[network_interface.key].self_link }\n }',
  );
  const model = await parse(content);
  const vm = model.nodes.find(
    (n) => n.address === "google_compute_instance.fixed",
  );
  assert.equal(parent(model, vm), undefined);
  assert.equal(vm.placementSource, undefined);
  assert.ok(
    vm.interfaceEvidence.some((s) => s.startsWith("dynamic network_interface")),
  );
  assert.equal(exportRoot(model), content);
});
