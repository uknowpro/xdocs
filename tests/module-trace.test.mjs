import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { importArchitecture } from "../desktop/architecture-import.mjs";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import {
  generateArchitecture,
  encodeArchitecture,
  decodeArchitecture,
} from "../shared/architecture.mjs";

const root = fileURLToPath(
  new URL("./fixtures/terraform-graph/", import.meta.url),
);
const vm = (m) => m.nodes.find((n) => n.address === "aws_instance.via_module");
test("project folder traces a module output through its input; nested source survives note and ZIP generation", async () => {
  const result = await importArchitecture([root], true);
  const model = decodeArchitecture(encodeArchitecture(result));
  assert.deepEqual(vm(model).moduleTrace, {
    address: "module.network.subnet_id",
    file: "module/main.tf",
    expression: '"${var.input}"',
    target: "aws_subnet.app",
  });
  assert.equal(vm(model).scopeAddress, undefined);
  const outputs = generateArchitecture(model, "terraform").files;
  for (const file of ["main.tf", "module/main.tf"])
    assert.equal(
      outputs["terraform/" + file],
      await readFile(path.join(root, file), "utf8"),
    );
  const single = await importArchitecture([path.join(root, "main.tf")]);
  assert.equal(vm(single).moduleTrace, undefined);
});
test("module-owned targets retain scope; conditional and remote outputs stay unresolved", async () => {
  const main = {
    name: "main.tf",
    content: await readFile(path.join(root, "main.tf"), "utf8"),
  };
  const resource = 'resource "aws_subnet" "app" {}\n';
  const child = {
    name: "module/outputs.tf",
    content: resource + 'output "subnet_id" { value = aws_subnet.app.id }',
  };
  const read = async (files) =>
    vm(await parseTerraformFiles(files)).moduleTrace;
  const trace = await read([main, child]);
  assert.equal(trace.target, "module.network.aws_subnet.app");
  assert.equal(trace.targetFile, child.name);
  assert.equal(
    (
      await read([
        main,
        {
          ...child,
          content:
            resource +
            'output "subnet_id" { value = var.flag ? aws_subnet.app.id : null }',
        },
      ])
    ).target,
    undefined,
  );
  assert.equal(
    await read([
      main,
      child,
      {
        name: "module/override.tf",
        content: 'output "subnet_id" { value = null }',
      },
    ]),
    undefined,
  );
  assert.equal(
    await read([
      {
        ...main,
        content: main.content.replace("./module", "example/network/aws"),
      },
      child,
    ]),
    undefined,
  );
  await assert.rejects(
    parseTerraformFiles([main, { ...child, name: "module/../outside.tf" }]),
  );
});
