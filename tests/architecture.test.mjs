import test from "node:test";
import assert from "node:assert/strict";
import { parse as yaml } from "yaml";
import {
  COMPONENTS,
  AVM_MODULES,
  newArchitecture,
  newComponent,
  architectureExample,
  generateArchitecture,
  architectureEdges,
  architectureIssues,
  removeComponent,
  encodeArchitecture,
  decodeArchitecture,
} from "../shared/architecture.mjs";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
export function fullExample() {
  const m = newArchitecture();
  m.title = "검증 아키텍처";
  for (const kind of Object.keys(COMPONENTS)) {
    const n = newComponent(kind);
    for (const [k, f] of Object.entries(COMPONENTS[kind].fields))
      if (f.ref) n.props[k] = m.nodes.find((n) => n.kind === f.ref).id;
    if (kind.includes("bucket"))
      n.props.name = "xdocs-test-bucket-" + m.nodes.length;
    if (kind.includes("storage_account"))
      n.props.name = "xdocsteststore" + m.nodes.length;
    if (kind === "aws_instance") n.props.ami = "ami-0123456789abcdef0";
    if (kind === "azurerm_linux_virtual_machine")
      n.props.ssh_key =
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDDUkK5+wnHE9gjotq/ZGpGKVdD6U2mpGd+d1SD+fZZSsvN80JNz7Na+AvPMmIj7/GrUAZL/wc22vWqDJdkLrqlrv8QrUoUduG28fuLd8b+yltaRSp59LpB4X5oG1FLvdbOr3DAzaPwQpi+WktpH5WSBTdjSXyDjODtu7+ML3bWQMsRIKI5cc4XS68uH7/hPdGFnPQcVTWtaLXQnFnMCUOatSHdZp+nqBeJWYiHAZ+jcqUxXUlE2s0ANcHM278cOLLDFjvUdHLGmdE0TTCdpl+02O8EPRbMJPbfeonz5SCGk6pSl3EsQOajHDMqPnAye7zwaSMUrd7aKsQ7OIpo003H xdocs-validation-only";
    m.nodes.push(n);
  }
  return m;
}
test("All cloud resources and pinned AVM modules produce native Terraform configuration", () => {
  const r = generateArchitecture(fullExample());
  assert.deepEqual(r.errors, []);
  const tf = JSON.parse(r.files["terraform/main.tf.json"]);
  for (const kind of Object.keys(COMPONENTS).filter(
    (k) => !k.startsWith("k8s_") && !k.startsWith("avm_"),
  ))
    assert.ok(tf.resource[kind], kind);
  assert.deepEqual(
    Object.values(tf.module).map((m) => m.version),
    Object.values(AVM_MODULES).map((m) => m.version),
  );
  const storage = Object.values(tf.module).find((m) =>
    m.source.includes("storageaccount"),
  );
  assert.equal(storage.public_network_access_enabled, false);
  assert.equal(storage.shared_access_key_enabled, false);
  assert.ok(
    storage.private_endpoints.blob.private_dns_zone_resource_ids.length,
  );
  assert.ok(tf.resource.azurerm_private_dns_zone_virtual_network_link);
  assert.equal(
    tf.provider.azapi.subscription_id,
    "${var.azure_subscription_id}",
  );
});
test("Selected Service exports dependencies with correct namespace, selector and ports", () => {
  const m = architectureExample(),
    s = m.nodes.find((n) => n.kind === "k8s_service");
  const r = generateArchitecture(m, "manifest", [s.id]);
  assert.deepEqual(r.errors, []);
  const docs = Object.entries(r.files)
    .filter(([f]) => f.startsWith("manifests/"))
    .map(([, v]) => yaml(v));
  assert.equal(docs.length, 3);
  const service = docs.find((d) => d.kind === "Service"),
    deployment = docs.find((d) => d.kind === "Deployment");
  assert.deepEqual(
    service.spec.selector,
    deployment.spec.template.metadata.labels,
  );
  assert.equal(
    service.spec.ports[0].targetPort,
    deployment.spec.template.spec.containers[0].ports[0].containerPort,
  );
  assert.equal(
    service.metadata.namespace,
    docs.find((d) => d.kind === "Namespace").metadata.name,
  );
  assert.ok(!r.files["terraform/main.tf.json"]);
});
test("Dangling references, invalid ports and removal invalidate generation instead of partial output", () => {
  const m = architectureExample(),
    dep = m.nodes.find((n) => n.kind === "k8s_deployment");
  const removed = removeComponent(m, dep.id);
  assert.ok(architectureIssues(removed).length);
  assert.ok(generateArchitecture(removed).errors.length);
  dep.props.port = "70000";
  assert.ok(generateArchitecture(m).errors.some((e) => e.includes("포트")));
});
test("User values stay literal in Terraform and Helm; document fence round trips", () => {
  const m = architectureExample();
  m.nodes[0].props.name = '${file("/private")} %{ if true }';
  m.review = { security: "메모 ``` $&" };
  assert.deepEqual(decodeArchitecture(encodeArchitecture(m)), m);
  const tf = JSON.parse(
    generateArchitecture(m).files["terraform/main.tf.json"],
  );
  assert.equal(
    Object.values(tf.resource.aws_vpc)[0].tags.Name,
    '$${file("/private")} %%{ if true }',
  );
});
test("HCL import preserves original modules, expressions, variables and comments with references", async () => {
  const content =
    '# original comment\nvariable "region" { default = "ap-northeast-2" }\nresource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }\nresource "aws_subnet" "app" {\n vpc_id=aws_vpc.main.id\n cidr_block="10.0.1.0/24"\n}\nmodule "custom" {\n source="./local-module"\n vpc=aws_vpc.main.id\n}\n';
  const m = await parseTerraformFiles([{ name: "main.tf", content }]);
  assert.equal(m.nodes.length, 3);
  assert.equal(architectureEdges(m).length, 2);
  assert.equal(generateArchitecture(m).files["terraform/main.tf"], content);
  const vpc = m.nodes.find((n) => n.kind === "aws_vpc");
  vpc.props.cidr = "10.2.0.0/16";
  const r = generateArchitecture(m);
  assert.equal(r.files["terraform/main.tf"], content);
  assert.equal(
    JSON.parse(r.files["terraform/zz_xdocs_override.tf.json"]).resource.aws_vpc
      .main.cidr_block,
    "10.2.0.0/16",
  );
  assert.throws(() => removeComponent(m, vpc.id));
});
test("Native tf.json import retains unknown resources and rejects conflicting definitions and unsafe filenames", async () => {
  const content = JSON.stringify({
    resource: { unknown_type: { example: { custom: { value: 42 } } } },
  });
  const m = await parseTerraformFiles([{ name: "main.tf.json", content }]);
  assert.equal(m.nodes[0].kind, "unknown_type");
  assert.equal(
    generateArchitecture(m).files["terraform/main.tf.json"],
    content,
  );
  await assert.rejects(parseTerraformFiles([{ name: "../main.tf", content }]));
  await assert.rejects(
    parseTerraformFiles([
      { name: "a.tf.json", content },
      { name: "b.tf.json", content },
    ]),
  );
  await assert.rejects(
    parseTerraformFiles([
      {
        name: "state.tf.json",
        content: '{"terraform_version":"1.5","resources":[]}',
      },
    ]),
  );
});
test("Existing override sources prevent ambiguous edited override export", async () => {
  const m = await parseTerraformFiles([
    {
      name: "main.tf",
      content: 'resource "aws_vpc" "main" { cidr_block="10.0.0.0/16" }',
    },
    { name: "other_override.tf", content: "# reserved" },
  ]);
  m.nodes[0].props.cidr = "10.2.0.0/16";
  assert.ok(generateArchitecture(m).errors.some((e) => e.includes("override")));
});

test("CloudFormation maps AWS references, retains S3 and excludes other providers explicitly", () => {
  const m = fullExample(),
    r = generateArchitecture(m, "cloudformation");
  assert.deepEqual(r.errors, []);
  assert.ok(!r.files["terraform/main.tf.json"]);
  const cf = JSON.parse(r.files["cloudformation/template.json"]);
  assert.equal(Object.keys(cf.Resources).length, 5);
  const routeTable = Object.values(cf.Resources).find(
    (r) => r.Type === "AWS::EC2::RouteTable",
  );
  assert.equal(
    cf.Resources[routeTable.Properties.VpcId.Ref].Type,
    "AWS::EC2::VPC",
  );
  for (const id of Object.keys(cf.Resources))
    assert.match(id, /^[A-Za-z][A-Za-z0-9]+$/);
  const resources = Object.values(cf.Resources),
    subnet = resources.find((r) => r.Type === "AWS::EC2::Subnet"),
    vm = resources.find((r) => r.Type === "AWS::EC2::Instance");
  assert.equal(cf.Resources[subnet.Properties.VpcId.Ref].Type, "AWS::EC2::VPC");
  assert.equal(
    cf.Resources[vm.Properties.SubnetId.Ref].Type,
    "AWS::EC2::Subnet",
  );
  assert.equal(
    resources.find((r) => r.Type === "AWS::S3::Bucket").DeletionPolicy,
    "Retain",
  );
  assert.ok(r.warnings.some((w) => w.includes("컴포넌트")));
});
test("Subnet outside its parent and invalid imported scalar changes are rejected", async () => {
  const m = architectureExample();
  m.nodes.find((n) => n.kind === "aws_subnet").props.cidr = "192.168.1.0/24";
  assert.ok(
    generateArchitecture(m).errors.some((e) => e.includes("상위 네트워크")),
  );
  const imported = await parseTerraformFiles([
    {
      name: "main.tf",
      content: 'resource "aws_vpc" "main" { cidr_block="10.0.0.0/16" }',
    },
  ]);
  imported.nodes[0].props.cidr = "bad";
  assert.ok(generateArchitecture(imported).errors.length);
});
test("network layout follows placement instead of arbitrary Terraform dependencies", async () => {
  const { boundaryLayout } = await import("../shared/network-boundaries.mjs");
  const m = architectureExample(),
    box = (model, id) => boundaryLayout(model).boxes.find((b) => b.id === id);
  const vm = m.nodes.find((n) => n.kind === "aws_instance"),
    subnet = m.nodes.find((n) => n.kind === "aws_subnet");
  const v = box(m, vm.id),
    s = box(m, subnet.id);
  assert.equal(v.parent, s.id);
  assert.ok(v.x > s.x && v.y > s.y && v.y + v.h <= s.y + s.h);
  const exported = generateArchitecture(m);
  const tf = JSON.parse(exported.files["terraform/main.tf.json"]);
  assert.ok(tf.variable["ami_" + vm.id]);
  assert.ok(
    JSON.parse(exported.files["cloudformation/template.json"]).Parameters,
  );
  const imported = await parseTerraformFiles([
    {
      name: "main.tf",
      content:
        'resource "aws_vpc" "a" {}\nresource "aws_vpc" "b" {}\nresource "aws_subnet" "s" {\n vpc_id=aws_vpc.a.id\n depends_on=[aws_vpc.b]\n}\nresource "aws_s3_bucket" "outside" { depends_on=[aws_vpc.a] }',
    },
  ]);
  const by = (a) => imported.nodes.find((n) => n.address === a);
  assert.equal(box(imported, by("aws_subnet.s").id).parent, by("aws_vpc.a").id);
  assert.equal(box(imported, by("aws_s3_bucket.outside").id).parent, undefined);
});
