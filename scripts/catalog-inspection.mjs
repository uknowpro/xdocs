import { readFile, writeFile } from "node:fs/promises";
import { parse, getReferencesInExpression } from "@cdktn/hcl2json";
import {
  fromCatalog,
  architectureCatalog,
} from "../shared/architecture-catalog.mjs";
import { generateArchitecture } from "../shared/architecture.mjs";

const root = new URL("../catalog/", import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, root), "utf8"));
const paths = await read("reviewed-paths.json");
export const addressOf = (node) =>
  node.address ||
  (node.kind.startsWith("avm_") ? "module" : node.kind) + "." + node.id;
export async function catalogModel(id) {
  return architectureCatalog.some((t) => t.id === id)
    ? fromCatalog(id)
    : read("snapshots/" + id + ".json");
}
export function terraformSources(model) {
  const output = generateArchitecture(model, "terraform");
  if (output.errors.length) throw Error(output.errors.join("\n"));
  return Object.entries(output.files)
    .filter(([name]) => /\.tf(?:\.json)?$/.test(name))
    .map(([path, content]) => ({
      name: path.slice("terraform/".length),
      content,
    }));
}
const decode = (file, content) =>
  file.endsWith(".json") ? JSON.parse(content) : parse(file, content);
function declaration(doc, address) {
  const parts = address.split(".");
  if (parts[0] === "module") return doc.module?.[parts[1]];
  if (parts[0] === "data") return doc.data?.[parts[1]]?.[parts[2]];
  return doc.resource?.[parts[0]]?.[parts[1]];
}
async function sitesFor(file, source, target) {
  const hits = [],
    sites = [];
  let prefix = "xdocssite";
  while (file.content.includes(prefix)) prefix += "x";
  const pattern = new RegExp(
    "(?<![\\w.-])" + target.replaceAll(".", "\\.") + "(?![\\w-])",
    "g",
  );
  const marked = file.content.replace(pattern, (value, offset) => {
    const marker = prefix + hits.length;
    hits.push({
      marker,
      line: file.content.slice(0, offset).split("\n").length,
    });
    return value.slice(0, value.lastIndexOf(".") + 1) + marker;
  });
  if (!hits.length) return sites;
  const doc = await decode(file.name, marked);
  async function visit(value, property) {
    if (typeof value === "string" && value.includes(prefix)) {
      const refs = property.split(".").includes("depends_on")
        ? [value]
        : (await getReferencesInExpression("ref.tf", value)).map(
            (r) => r.value,
          );
      for (const { marker, line } of hits) {
        if (refs.some((ref) => ref.split(/[^\w-]+/).includes(marker)))
          if (!sites.some((s) => s.line === line && s.property === property))
            sites.push({ file: file.name, line, property });
      }
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        await visit(
          item,
          Array.isArray(value)
            ? property
            : [property, key].filter(Boolean).join("."),
        );
      }
    }
  }
  await visit(declaration(doc, source), "");
  return sites;
}
export async function inspect(id, model) {
  const files = terraformSources(model).filter((f) => !f.name.includes("/"));
  const inputs = new Set();
  for (const file of files) {
    const doc = await decode(file.name, file.content);
    for (const [key, value] of Object.entries(doc.variable || {})) {
      const block = Array.isArray(value) ? value[0] : value;
      if (!Object.hasOwn(block, "default")) inputs.add(key);
    }
  }
  const [source, target] = paths[id][0].map((key) =>
    model.nodes.find((n) => (n.address || n.label) === key),
  );
  const sites = [];
  for (const file of files.filter(
    (f) => !source.sourceFile || f.name === source.sourceFile,
  ))
    sites.push(...(await sitesFor(file, addressOf(source), addressOf(target))));
  return { inputs: [...inputs].sort(), sites };
}
if (process.argv.includes("--write")) {
  const entries = {};
  for (const id of Object.keys(paths))
    entries[id] = await inspect(id, await catalogModel(id));
  await writeFile(
    new URL("inspection.json", root),
    JSON.stringify(entries, null, 2) + "\n",
  );
}
