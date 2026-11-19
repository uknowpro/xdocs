import test from "node:test";
import assert from "node:assert/strict";
import {
  templates,
  encodeWorkflow,
  decodeWorkflow,
  replaceWorkflow,
  workflowNodes,
  addBlock,
} from "../shared/workflows.mjs";
for (const [kind, template] of Object.entries(templates)) {
  test(kind + " source and layout survive a note round trip", () => {
    const source = template.source.replaceAll("\n", "\r\n");
    const model = { kind, version: 1, source, positions: {} };
    const body = "intro\n" + encodeWorkflow(model) + "\noutro";
    const nodes = workflowNodes(kind, source);
    assert.ok(nodes.length);
    const changed = {
      ...model,
      positions: { [nodes[0].id]: { x: 50, y: 60 } },
    };
    const saved = replaceWorkflow(body, changed);
    assert.deepEqual(decodeWorkflow(saved), changed);
    assert.ok(saved.endsWith("\noutro"));
    assert.ok(
      workflowNodes(kind, addBlock(kind, source)).length > nodes.length,
    );
  });
}
test("stack references and original conditions survive import", () => {
  const source =
    "Conditions:\n  Use: !Equals [a, b]\nResources:\n  A: {Type: AWS::S3::Bucket}\n  B:\n    Type: AWS::CloudFormation::Stack\n    Properties: {TemplateURL: !GetAtt A.WebsiteURL}\n";
  const [, b] = workflowNodes("cloudformation", source);
  assert.deepEqual(b.refs, ["A"]);
  assert.match(source.slice(b.start, b.end), /TemplateURL/);
});

test("Actions diagnoses missing and cyclic job dependencies without changing source", async()=>{
  const {jobDependencyIssues}=await import("../shared/workflows.mjs");
  const nodes=workflowNodes("actions","jobs:\n  build:\n    needs: test\n  test:\n    needs: [build, absent]\n");
  const issues=jobDependencyIssues(nodes).join("\n");
  assert.match(issues,/build → test → build/);assert.match(issues,/absent/);
});
