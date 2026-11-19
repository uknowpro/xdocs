import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateArchitecture } from "../shared/architecture.mjs";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import { caseDiagram } from "../shared/case-diagrams.mjs";

const catalog = JSON.parse(
  await readFile(new URL("../catalog/case-studies.json", import.meta.url)),
);
for (const study of catalog)
  test(study.name + " preserves declarations and diagram targets", async () => {
    const m = JSON.parse(
      await readFile(
        new URL("../catalog/snapshots/" + study.id + ".json", import.meta.url),
      ),
    );
    const result = generateArchitecture(m, "terraform");
    assert.deepEqual(result.errors, []);
    const svg = caseDiagram(m);
    assert.equal(result.files["case-study.svg"], svg);
    const targets = [...svg.matchAll(/data-resource="([^"]+)"/g)].map(
      (x) => x[1],
    );
    assert.ok(targets.length >= 9);
    assert.ok(targets.every((id) => m.nodes.some((n) => n.id === id)));
    const files = m.sources.map((f) => ({
      name: f.name,
      content: result.files["terraform/" + f.name],
    }));
    assert.deepEqual(files, m.sources.map(({name,content})=>({name,content})));
    const reparsed = await parseTerraformFiles(files);
    assert.deepEqual(
      reparsed.nodes.map((n) => [n.address, n.references]),
      m.nodes.map((n) => [n.address, n.references]),
    );
  });


for (const [id, paths] of Object.entries({
  "organization-audit":[["aws_cloudtrail.organization","aws_s3_bucket.audit"],["aws_s3_bucket_policy.delivery","data.aws_organizations_organization.org"]],
  "regional-app-dr":[["azurerm_traffic_manager_azure_endpoint.primary","azurerm_linux_web_app.primary"],["azurerm_traffic_manager_azure_endpoint.recovery","azurerm_linux_web_app.recovery"]],
  "dual-cloud-branches":[["aws_vpn_connection.west","aws_customer_gateway.west"],["google_compute_router_interface.east","google_compute_vpn_tunnel.east"],["google_compute_router_peer.west","google_compute_router_interface.west"]]
})) test(id+" ships the reviewed source and redundant paths", async()=>{
  const m=JSON.parse(await readFile(new URL("../catalog/snapshots/"+id+".json",import.meta.url)));
  assert.equal(m.sources[0].content,await readFile(new URL("../catalog/enterprise/"+id+"/main.tf",import.meta.url),"utf8"));
  for(const [source,target] of paths) assert.ok(m.nodes.find(n=>n.address===source)?.references.includes(target),source+" → "+target);
});
