import {jsonDeclarationLines} from "../shared/declaration-lines.mjs";
import { attachModuleTraces, localDir } from "./local-modules.mjs";
import { placementFields } from "../shared/network-boundaries.mjs";
import { parse, getReferencesInExpression } from "@cdktn/hcl2json";
import {
  newArchitecture,
  generateArchitecture,
  validateArchitecture,
  IMPORT_FIELDS,
} from "../shared/architecture.mjs";
// Label individual source occurrences, then let the same Terraform parser identify
// the occurrence that actually supplies the placement attribute (excluding comments).
async function locateReferences(file) {
  const spans = new Map();
  let prefix = "xdocsplacement";
  while (file.content.includes(prefix)) prefix += "x";
  const marked = file.content.replace(
    /\b((?:data\.)?[A-Za-z_][\w-]*\.[A-Za-z_][\w-]*)(?=\.(?:id|name|self_link)\b)/g,
    (address, _, offset) => {
      const marker = prefix + spans.size;
      spans.set(marker, { file: file.name, offset, address });
      return address.slice(0, address.lastIndexOf(".") + 1) + marker;
    },
  );
  if (!spans.size) return {};
  try {
    const parsed = file.name.endsWith(".json")
      ? JSON.parse(marked)
      : await parse(file.name, marked);
    return { parsed, spans };
  } catch {
    return {};
  }
}
// Let the HCL parser distinguish real block headers from matches in comments or heredocs.
async function declarationLines(file) {
  const lines = new Map();
  if (file.name.endsWith(".json")) return jsonDeclarationLines(file.content);
  let prefix = "xdocsdecl";
  while (file.content.includes(prefix)) prefix += "x";
  const candidates = [];
  const marked = file.content
    .split("\n")
    .map((line, i) =>
      line.replace(
        /^(\s*)(?:(resource|data)\s+"([^"]+)"\s+|(module)\s+)"([\w-]+)"(\s*\{)/,
        (header, space, block, kind, module, name, brace) => {
          const marker = prefix + candidates.length;
          candidates.push({
            block: block || module,
            kind,
            name,
            marker,
            line: i + 1,
          });
          return (
            space +
            (block ? block + ' "' + kind + '" ' : "module ") +
            '"' +
            marker +
            '"' +
            brace
          );
        },
      ),
    )
    .join("\n");
  if (!candidates.length) return lines;
  try {
    const parsed = await parse(file.name, marked);
    for (const c of candidates) {
      const items =
        c.block === "module" ? parsed.module : parsed[c.block]?.[c.kind];
      if (items && Object.hasOwn(items, c.marker)) {
        const address =
          c.block === "module"
            ? "module." + c.name
            : (c.block === "data" ? "data." : "") + c.kind + "." + c.name;
        lines.set(address, c.line);
      }
    }
  } catch {}
  return lines;
}
const nestedPlacement = {
  google_compute_instance: ["network_interface", "subnetwork"],
  azurerm_network_interface: ["ip_configuration", "subnet_id"],
};
function placementSlot(n, raw) {
  const attr = placementFields[n.kind]?.[2];
  if (attr) return [raw, attr];
  if (!Object.hasOwn(nestedPlacement, n.kind)) return [];
  const [block, key] = nestedPlacement[n.kind];
  if (raw?.dynamic?.[block]) return [];
  const list = raw?.[block];
  return [Array.isArray(list) ? list.length === 1 && list[0] : list, key];
}
function placement(n, raw) {
  const [owner, key] = placementSlot(n, raw);
  return owner?.[key];
}
export async function parseTerraformFiles(files) {
  validateArchitecture({ ...newArchitecture(), sources: files });
  // Recover editing state only when the complete file can be reproduced by our exporter.
  const overlay = files.find((f) => f.name === "zz_xdocs_override.tf.json");
  if (
    overlay &&
    files.length > 1 &&
    !files.some(
      (f) =>
        f !== overlay &&
        !f.name.includes("/") &&
        /(?:^|_)override\.tf(?:\.json)?$/.test(f.name),
    )
  ) {
    let base;
    try {
      base = await parseBase(files.filter((f) => f !== overlay));
    } catch {
      // An ordinary Terraform file with the reserved name may itself contain the only resources.
      return parseBase(files);
    }
    const values = JSON.parse(overlay.content)?.resource;
    if (values && typeof values === "object") {
      for (const node of base.nodes) {
        if (node.address.startsWith("data.")) continue;
        const [type, name] = node.address.split(".");
        for (const [key, attr] of Object.entries(IMPORT_FIELDS[type] || {})) {
          const value = values[type]?.[name]?.[attr];
          if (Object.hasOwn(node.original, key) && typeof value === "string")
            node.props[key] = value
              .replaceAll("$${", () => "${")
              .replaceAll("%%{", "%{");
        }
      }
      if (
        generateArchitecture(base, "terraform").files[
          "terraform/" + overlay.name
        ] === overlay.content
      )
        return validateArchitecture(base);
    }
  }
  return parseBase(files);
}
async function parseBase(files) {
  const model = newArchitecture();
  model.title = "가져온 Terraform";
  model.sources = files.map(file => ({...file}));
  validateArchitecture(model);
  const addresses = new Set(),
    pending = [];
  const calls = new Map();
  for (const file of files.filter((f) => !f.name.includes("/"))) {
    let parsed;
    try {
      parsed = file.name.endsWith(".json")
        ? JSON.parse(file.content)
        : await parse(file.name, file.content);
    } catch {
      throw Error("Terraform 구문을 읽지 못했습니다. 파일 형식을 확인하세요.");
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.format_version ||
      parsed.terraform_version
    )
      throw Error(
        "계획·state JSON 대신 .tf 또는 구성 .tf.json 파일을 선택하세요.",
      );
    const storedFile = { ...file, preservedDeclarations: Object.entries(parsed)
      .filter(([key]) => !["resource","data","module"].includes(key))
      .flatMap(([key,value]) => key === "terraform" ? [key] : Object.keys(value || {}).map(name => key+"."+name)) };
    model.sources = model.sources.map(source => source.name === file.name ? storedFile : source);
    const located = await locateReferences(file);
    const lines = await declarationLines(file);
    for (const block of ["resource", "data", "module"]) {
      const entries =
        block === "module"
          ? Object.entries(parsed.module || {}).map(([name, v]) => [
              "module",
              name,
              v,
            ])
          : Object.entries(parsed[block] || {}).flatMap(([kind, items]) =>
              Object.entries(items).map(([name, v]) => [kind, name, v]),
            );
      for (const [kind, name, value] of entries) {
        const raw = Array.isArray(value) ? value[0] : value,
          address = (block === "data" ? "data." : "") + kind + "." + name;
        if (addresses.has(address))
          throw Error(
            "중복 리소스 정의가 있습니다. 같은 모듈의 중복되지 않는 파일을 선택하세요.",
          );
        addresses.add(address);
        if (block === "module") calls.set(address, raw);
        const props = {};
        if (block === "resource")
          for (const [key, attr] of Object.entries(IMPORT_FIELDS[kind] || {})) {
            const v = raw?.[attr];
            if (
              attr &&
              typeof v === "string" &&
              !v.includes("${") &&
              !v.includes("%{")
            )
              props[key] = v;
          }
        const n = {
          id: "n_import_" + model.nodes.length,
          kind,
          label: address,
          x: 60 + (model.nodes.length % 4) * 240,
          y: 60 + Math.floor(model.nodes.length / 4) * 140,
          props,
          original: { ...props },
          imported: true,
          sourceFile: file.name,
          ...(["aws_subnet","google_compute_subnetwork"].includes(kind) && typeof (raw?.availability_zone || raw?.region)==="string"
            ? {locationScope:raw.availability_zone || raw.region} : {}),
          ...(lines.has(address) ? { sourceLine: lines.get(address) } : {}),
          ...(raw?.count !== undefined || raw?.for_each !== undefined
            ? { multipleInstances: true }
            : {}),
          address,
          references: [],
        };
        if (block === "module" && localDir(raw.source)) n.moduleDirectory = localDir(raw.source);
        if (block === "resource" && kind === "azurerm_subnet" && Array.isArray(raw.address_prefixes))
          n.subnetPrefixes = raw.address_prefixes.filter(value => typeof value === "string");
        model.nodes.push(n);
        const marked = located.parsed?.[block]?.[kind]?.[name];
        pending.push([
          n,
          raw,
          Array.isArray(marked) ? marked[0] : marked,
          located.spans,
        ]);
      }
    }
  }
  if (!model.nodes.length)
    throw Error("리소스·data·module 선언이 있는 구성 파일을 함께 선택하세요.");
  validateArchitecture(model);
  let inspected = 0;
  async function scan(value, out, depth = 0) {
    if (++inspected > 100000 || depth > 50)
      throw Error("Terraform 구조가 너무 큽니다.");
    if (typeof value === "string" && value.includes("${")) {
      try {
        for (const r of await getReferencesInExpression(
          "references.tf",
          value,
        )) {
          out.add(
            r.value
              .replace(/\[[^\]]*\]/g, "")
              .split(".")
              .slice(0, r.value.startsWith("data.") ? 3 : 2)
              .join("."),
          );
        }
      } catch {
        model.warnings.push(
          "일부 표현식의 참조를 해석하지 못했습니다. 원본은 보존합니다.",
        );
      }
    } else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (k === "depends_on" && Array.isArray(v))
          for (const ref of v)
            if (typeof ref === "string")
              out.add(
                ref
                  .replace(/^\$\{|\}$/g, "")
                  .split(".")
                  .slice(0, ref.startsWith("data.") ? 3 : 2)
                  .join("."),
              );
        await scan(v, out, depth + 1);
      }
  }
  for (const [n, raw, marked, spans] of pending) {
    const value = placement(n, raw);
    const direct =
      typeof value === "string" &&
      value.match(
        /^\$\{((?:data\.)?[A-Za-z_][\w-]*\.[A-Za-z_][\w-]*)\.(?:id|name|self_link)\}$/,
      );
    if (direct && addresses.has(direct[1])) n.scopeAddress = direct[1];
    const markedValue = placement(n, marked);
    const marker =
      typeof markedValue === "string" &&
      markedValue.match(/\.(\w+)\.(?:id|name|self_link)\}$/)?.[1];
    const span = marker && spans?.get(marker);
    if (
      n.scopeAddress &&
      span?.address === n.scopeAddress &&
      !n.address.startsWith("data.")
    ) {
      const without = structuredClone(raw);
      const [owner, key] = placementSlot(n, without);
      delete owner[key];
      const rest = new Set();
      await scan(without, rest);
      n.placementSource = {
        ...span,
        otherRefs: [...rest].filter((r) => addresses.has(r) && r !== n.address),
      };
    } else if (value !== undefined || Object.hasOwn(nestedPlacement, n.kind))
      n.placementUnknown = true;
    if (!n.placementSource && typeof value === "string")
      n.placementValue = value;
    if (
      [
        "azurerm_linux_virtual_machine",
        "azurerm_windows_virtual_machine",
      ].includes(n.kind) &&
      raw.network_interface_ids !== undefined
    ) {
      n.placementUnknown = true;
      const ids = raw.network_interface_ids;
      if (Array.isArray(ids) && ids.length === 1 && typeof ids[0] === "string")
        n.placementValue = ids[0];
      const single = n.placementValue?.match(
        /^\$\{(azurerm_network_interface\.[\w-]+)\.id\}$/,
      );
      if (single && addresses.has(single[1])) n.nicAddress = single[1];
    }
    if (n.kind === "google_compute_instance" && value === undefined) {
      const interfaces = raw.network_interface;
      const blocks = Array.isArray(interfaces)
        ? interfaces
        : interfaces
          ? [interfaces]
          : [];
      const details = [];
      for (const [index, block] of blocks.entries()) {
        for (const field of ["network", "subnetwork"]) {
          if (typeof block?.[field] === "string")
            details.push(
              `network_interface[${index}].${field} = ${JSON.stringify(block[field])}`,
            );
        }
      }
      if (raw.dynamic?.network_interface)
        details.push(
          "dynamic network_interface · Terraform 평가 시 NIC 구성 결정",
        );
      if (details.length) n.interfaceEvidence = details;
    }
    const refs = new Set();
    const warningsBeforeScan = model.warnings.length;
    await scan(raw, refs);
    const unresolved = [...refs].filter(r => !addresses.has(r) && !/^(var|local|each|count|path|terraform|self)\./.test(r));
    if (model.warnings.length > warningsBeforeScan) unresolved.push("표현식 확인 필요");
    if (unresolved.length) n.unresolvedReferences = unresolved;
    n.references = [...refs].filter((r) => r !== n.address && addresses.has(r));
  }
  await attachModuleTraces(model, calls, declarationLines);
  model.warnings = [
    ...new Set([
      ...model.warnings,
      "원본 Terraform 설정을 그대로 보관합니다. 변수 기본값·문자열·주석에 비밀정보가 포함되어 있다면 가져오기 전에 제거하세요.",
      "count/for_each는 리소스 선언 하나로 표시합니다. 로컬·원격 모듈은 내부를 실행하거나 펼치지 않습니다.",
    ]),
  ];
  return validateArchitecture(model);
}
