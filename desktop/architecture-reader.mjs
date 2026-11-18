import { placementFields } from "../shared/network-boundaries.mjs";
import { parse, getReferencesInExpression } from "@cdktn/hcl2json";
import {
  newArchitecture,
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
function placement(n, raw) {
  const attr = placementFields[n.kind]?.[2];
  if (attr) return raw?.[attr];
  if (n.kind === "google_compute_instance") {
    const nic = raw?.network_interface;
    return (Array.isArray(nic) ? nic.length === 1 && nic[0] : nic)?.subnetwork;
  }
}
export async function parseTerraformFiles(files) {
  const model = newArchitecture();
  model.title = "가져온 Terraform";
  model.sources = files;
  validateArchitecture(model);
  const addresses = new Set(),
    pending = [];
  for (const file of files) {
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
    const located = await locateReferences(file);
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
          ...(raw?.count !== undefined || raw?.for_each !== undefined
            ? { multipleInstances: true }
            : {}),
          address,
          references: [],
        };
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
      const field = placementFields[n.kind]?.[2];
      if (field) delete without[field];
      else {
        const nic = without.network_interface;
        delete (Array.isArray(nic) ? nic[0] : nic).subnetwork;
      }
      const rest = new Set();
      await scan(without, rest);
      n.placementSource = {
        ...span,
        otherRefs: [...rest].filter((r) => addresses.has(r) && r !== n.address),
      };
    } else if (value !== undefined || n.kind === "google_compute_instance")
      n.placementUnknown = true;
    if (!n.placementSource && typeof value === "string")
      n.placementValue = value;
    const refs = new Set();
    await scan(raw, refs);
    n.references = [...refs].filter((r) => r !== n.address && addresses.has(r));
  }
  model.warnings = [
    ...new Set([
      ...model.warnings,
      "원본 Terraform 설정을 그대로 보관합니다. 변수 기본값·문자열·주석에 비밀정보가 포함되어 있다면 가져오기 전에 제거하세요.",
      "count/for_each는 리소스 선언 하나로 표시합니다. 로컬·원격 모듈은 내부를 실행하거나 펼치지 않습니다.",
    ]),
  ];
  return validateArchitecture(model);
}
