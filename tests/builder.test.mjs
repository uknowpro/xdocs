import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import {
  newBuilder,
  encodeBuilder,
  decodeBuilder,
  replaceBuilder,
  reviewSheet,
} from "../shared/builder.mjs";
import {
  fromCatalog,
  architectureCatalog,
  terraformDeclarations,
} from "../shared/architecture-catalog.mjs";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import { generateArchitecture } from "../shared/architecture.mjs";
import { runBuilderModel } from "../desktop/builder-model.mjs";
import { builderResources } from "../desktop/builder-mcp.mjs";
test("custom harness and cell evidence survive file round trip", () => {
  const config = newBuilder();
  config.prompt = "custom ``` $&";
  config.rules[0].threshold = 100;
  const page = "# title\n" + encodeBuilder(newBuilder());
  assert.deepEqual(decodeBuilder(replaceBuilder(page, config)), config);
  const sheet = {
    name: "예산",
    rows: [["비용"], ["1,200"], ["100"], [""], ["1,0,0"], ["100"]],
  };
  assert.deepEqual(
    reviewSheet(sheet, config.rules).findings.map((f) => f.cell),
    ["예산!A2"],
  );
  assert.deepEqual(
    reviewSheet(sheet, newBuilder("inventory").rules).findings.map(
      (f) => f.cell,
    ),
    ["예산!A3", "예산!A6"],
  );
  assert.deepEqual(
    reviewSheet(sheet, newBuilder("quality").rules).findings.map((f) => f.cell),
    ["예산!A4"],
  );
});
test("catalog builds isolated diagrams and maps generated declarations", async () => {
  for (const entry of architectureCatalog) {
    const m = fromCatalog(entry.id),
      next = fromCatalog(entry.id);
    assert.notEqual(m.nodes[0].id, next.nodes[0].id);
    const out = generateArchitecture(m, "terraform");
    assert.deepEqual(out.errors, []);
    const file = out.files["terraform/main.tf.json"];
    const imported = await parseTerraformFiles([
      { name: "main.tf.json", content: file },
    ]);
    for (const original of terraformDeclarations(file, m.nodes))
      assert.ok(
        imported.nodes.some((n) => n.address === original.address),
        original.address,
      );
    assert.equal(
      generateArchitecture(imported, "terraform").files[
        "terraform/main.tf.json"
      ],
      file,
    );
    assert.equal(
      terraformDeclarations(out.files["terraform/main.tf.json"], m.nodes)
        .length,
      m.nodes.length,
      entry.id,
    );
  }
});
test("Builder sends only the requested input to the compatible endpoint", async () => {
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const part of req) raw += part;
    const data = JSON.parse(raw);
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ message: { content: data.messages[0].content } }],
      }),
    );
  }).listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const endpoint = "http://127.0.0.1:" + server.address().port;
    assert.equal(
      await runBuilderModel({
        endpoint,
        model: "test",
        key: "",
        prompt: "시트!C2",
      }),
      "시트!C2",
    );
    await assert.rejects(
      runBuilderModel({
        endpoint: "http://example.org",
        model: "test",
        prompt: "sample",
      }),
      /HTTPS/,
    );
  } finally {
    server.close();
  }
});
test("MCP resource list and read via Streamable HTTP", async () => {
  const methods = [];
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const msg = JSON.parse(raw);
    methods.push(msg.method);
    if (msg.id === undefined) {
      res.writeHead(202).end();
      return;
    }
    const result =
      msg.method === "initialize"
        ? {
            protocolVersion: msg.params.protocolVersion,
            capabilities: { resources: {}, tools: {} },
            serverInfo: { name: "test", version: "1" },
          }
        : msg.method === "tools/list"
          ? {
              tools: [
                {
                  name: "lookup",
                  inputSchema: { type: "object" },
                  annotations: { readOnlyHint: true },
                },
                { name: "write", inputSchema: { type: "object" } },
              ],
            }
          : msg.method === "tools/call"
            ? { content: [{ type: "text", text: msg.params.arguments.id }] }
            : msg.method === "resources/list"
              ? { resources: [{ name: "단가", uri: "data:price" }] }
              : { contents: [{ uri: msg.params.uri, text: "단가 기준" }] };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
  }).listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const endpoint = "http://127.0.0.1:" + server.address().port;
    assert.equal(
      (await builderResources({ endpoint })).resources[0].name,
      "단가",
    );
    assert.equal(
      (await builderResources({ endpoint, uri: "data:price" })).text,
      "단가 기준",
    );
    assert.deepEqual(
      (await builderResources({ endpoint, listTools: true })).tools.map(
        (t) => t.name,
      ),
      ["lookup"],
    );
    await assert.rejects(
      builderResources({ endpoint, tool: "write", args: {} }),
      /읽기 전용/,
    );
    assert.ok(!methods.includes("tools/call"));
    assert.equal(
      (
        await builderResources({
          endpoint,
          tool: "lookup",
          args: { id: "근거 1" },
        })
      ).text,
      "근거 1",
    );
  } finally {
    server.close();
  }
});

test("HCL source navigation ignores commented blocks and scopes child modules", async () => {
  const text =
    '/*\nresource "aws_vpc" "main" {\n}\n*/\nresource "aws_vpc" "main" {\n  cidr_block="10.0.0.0/16"\n}';
  const m = await parseTerraformFiles([
    { name: "network.tf", content: text },
    { name: "modules/network/main.tf", content: text },
  ]);
  assert.equal(m.nodes.length, 1);
  assert.equal(m.nodes[0].sourceFile, "network.tf");
  assert.equal(m.nodes[0].sourceLine, 5);
});

test("visual annotations preserve exported Terraform for every cloud", async () => {
  const { boundarySVG } = await import("../shared/network-boundaries.mjs");
  for (const id of architectureCatalog.map(t => t.id)) {
    const m = fromCatalog(id),
      before = generateArchitecture(m, "terraform");
    m.presentation = {
      annotationLinks: [
        { source: m.nodes[0].id, target: m.nodes[1].id, label: "담당 <팀>" },
      ],
    };
    assert.match(boundarySVG(m), /data-annotation-link/);
    assert.match(boundarySVG(m), /&lt;팀&gt;/);
    const after = generateArchitecture(m, "terraform");
    assert.deepEqual(after.errors, []);
    for (const [path, code] of Object.entries(before.files))
      if (path.startsWith("terraform/")) assert.equal(after.files[path], code);
  }
});
test("meeting harness cites original Markdown lines", () => {
  const sheet = {
    noteLines: true,
    name: "회의",
    rows: [["본문"], ["# 회의"], [""], ["- [ ] 담당자 확인"]],
  };
  assert.deepEqual(
    reviewSheet(sheet, newBuilder("meeting").rules).findings.map((f) => f.cell),
    ["회의 L3"],
  );
});

test("all enterprise catalog designs are distinct and retain Terraform contents after reimport", async () => {
  const { readFile } = await import("node:fs/promises");
  const index = JSON.parse(
    await readFile(new URL("../catalog/sources.json", import.meta.url)),
  );
  const all = [...architectureCatalog, ...index];
  assert.equal(new Set(all.map((t) => t.id)).size, all.length);
  for (const provider of ["AWS", "Azure", "GCP"])
    assert.ok(all.some(t => t.provider === provider));
  const snapshotIds = (await (await import("node:fs/promises")).readdir(new URL("../catalog/snapshots/", import.meta.url))).map(f=>f.replace(/\.json$/, ""));
  const studies = JSON.parse(await readFile(new URL("../catalog/case-studies.json", import.meta.url)));
  assert.deepEqual(snapshotIds.sort(), [...index, ...studies].map(t=>t.id).sort());
  assert.equal(all.filter(t => t.provider === "멀티클라우드").length, 2);
  for (const t of index) {
    const m = JSON.parse(
      await readFile(
        new URL("../catalog/snapshots/" + t.id + ".json", import.meta.url),
      ),
    );
    assert.ok(t.study && m.nodes.length >= 7, t.id);
    if(t.provider === "멀티클라우드"){
      const families = new Set(m.nodes.map(n => n.kind.split("_")[0]));
      assert.ok(families.has("google") && (families.has("aws") || families.has("azurerm")), t.id);
    }
    const result = generateArchitecture(m, "terraform");
    assert.deepEqual(result.errors, [], t.id);
    const files = m.sources.map((f) => ({
      name: f.name,
      content: result.files["terraform/" + f.name],
    }));
    assert.deepEqual(files, m.sources, t.id);
    assert.ok(
      files
        .find((f) => f.name === "xdocs-source-notice.tf")
        .content.includes(t.revision),
    );
    const reparsed = await parseTerraformFiles(files);
    const graph = (nodes) =>
      nodes.map((n) => [n.address, n.scopeAddress, n.references]);
    assert.deepEqual(graph(reparsed.nodes), graph(m.nodes), t.id);
  }
});
test("dependent steps preserve row numbers and stop when empty", () => {
  const sheet = {
    name: "예산",
    rows: [
      ["비용", "담당"],
      ["200", ""],
      ["2", ""],
      ["250", "kim"],
    ],
  };
  const high = { ...newBuilder().rules[0], threshold: 100 };
  const missing = {
    ...newBuilder("quality").rules[0],
    column: 1,
    input: "previous",
  };
  const result = reviewSheet(sheet, [high, missing]);
  assert.deepEqual(
    result.steps.map((s) => [s.inputs, s.matches]),
    [
      [3, 2],
      [2, 1],
    ],
  );
  assert.equal(result.findings.at(-1).cell, "예산!B2");
  assert.equal(
    reviewSheet(sheet, [
      { ...high, threshold: 1000, stopOnEmpty: true },
      missing,
    ]).steps.length,
    1,
  );
});

test("model profiles scope stored secrets to the endpoint and model and return metadata only", async () => {
  const { modelProfiles } = await import("../desktop/builder-profiles.mjs");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "xdocs-model-test-"));
  try {
    const profiles = modelProfiles(dir, {
      isEncryptionAvailable: () => true,
      encryptString: (v) => Buffer.from(v),
      decryptString: (b) => b.toString(),
    });
    const profile = {
      name: "local",
      model: "sample",
      endpoint: "http://localhost:8000/v1/chat/completions",
      key: "test-only",
      remember: true,
    };
    const [saved] = await profiles.save(profile);
    assert.ok(saved.hasKey);
    assert.equal(saved.secret, undefined);
    assert.equal(
      await profiles.keyFor("local", profile.endpoint, "sample"),
      "test-only",
    );
    assert.equal(
      await profiles.keyFor("local", "https://other.invalid/api", "sample"),
      "",
    );
    await profiles.save({ ...profile, key: "", remember: false });
    assert.equal(
      await profiles.keyFor("local", profile.endpoint, "sample"),
      "",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("new cloud components validate placement and preserve it on Terraform reimport", async () => {
  const { newArchitecture, newComponent, architectureIssues } =
    await import("../shared/architecture.mjs");
  const { boundaryLayout, canPlace } =
    await import("../shared/network-boundaries.mjs");
  for (const [kind, parentKind, field] of [
    ["aws_route_table", "aws_vpc", "vpc"],
    ["azurerm_network_security_group", "azurerm_resource_group", "group"],
    ["google_compute_router", "google_compute_network", "network"],
  ]) {
    const m = newArchitecture(),
      parent = newComponent(parentKind),
      child = newComponent(kind);
    m.nodes = [parent, child];
    assert.ok(architectureIssues(m).some((i) => i.id === child.id));
    assert.equal(canPlace(m, child, child), false);
    child.props[field] = parent.id;
    assert.equal(boundaryLayout(m).parents.get(child.id), parent.id);
    const out = generateArchitecture(m, "terraform");
    assert.deepEqual(out.errors, []);
    const result = await parseTerraformFiles([
      { name: "main.tf.json", content: out.files["terraform/main.tf.json"] },
    ]);
    const restored = result.nodes.find((n) => n.kind === kind);
    assert.equal(restored.scopeAddress, parentKind + "." + parent.id);
    if (kind === "aws_route_table")
      assert.match(
        generateArchitecture(m, "cloudformation").files[
          "cloudformation/template.json"
        ],
        /AWS::EC2::RouteTable/,
      );
  }
});

test("structured drafts distinguish missing evidence, unknown addresses and invalid output", async () => {
  const {evaluateEvidenceJson} = await import("../shared/builder.mjs");
  const findings = [{cell:"시트!A2"}, {cell:"시트!A20"}, {cell:"시트!A2"}];
  assert.deepEqual(evaluateEvidenceJson('{"summary":"ok","evidence":["시트!A20","시트!B2"]}', findings),
    {missing:["시트!A2"],unknown:["시트!B2"]});
  for (const text of ["null", "[]", "invalid", '{"summary":"","evidence":[1]}'])
    assert.ok(evaluateEvidenceJson(text, findings).error);
});
