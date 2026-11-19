// Run from any directory after editing a case's Terraform or catalog metadata.
import { readFile, writeFile } from "node:fs/promises";
import { parseTerraformFiles } from "../../desktop/architecture-reader.mjs";
import { generateArchitecture } from "../../shared/architecture.mjs";
import { enterpriseCases } from "../../shared/enterprise-case-layouts.mjs";
const url = (path) => new URL(path, import.meta.url);
const catalog = JSON.parse(await readFile(url("../case-studies.json"), "utf8"));
for (const id of Object.keys(enterpriseCases)) {
  const study = catalog.find((t) => t.id === id);
  const content = await readFile(url("./" + id + "/main.tf"), "utf8");
  const m = await parseTerraformFiles([{ name: "main.tf", content }]);
  Object.assign(m, {
    caseStudyId: id,
    title: study.provider + " · " + study.name,
    review: study.review,
  });
  study.kinds = [...new Set(m.nodes.map((n) => n.kind))].sort();
  if (
    generateArchitecture(m, "terraform").files["terraform/main.tf"] !== content
  )
    throw Error("Round trip failed: " + id);
  await writeFile(
    url("../snapshots/" + id + ".json"),
    JSON.stringify(m, null, 2) + "\n",
  );
}
await writeFile(
  url("../case-studies.json"),
  JSON.stringify(catalog, null, 2) + "\n",
);
