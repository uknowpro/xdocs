import { gunzipSync, strFromU8 } from "fflate";
import snapshot from "./schema-snapshot.mjs";
let catalog;
function schemaData() {
  if (!catalog)
    catalog = JSON.parse(
      strFromU8(
        gunzipSync(Uint8Array.from(atob(snapshot), (c) => c.charCodeAt(0))),
      ),
    );
  return catalog;
}
export function resourceSchema(kind) {
  if (kind.startsWith("arm_")) kind = "azapi_resource";
  const [types, shapes, hashes] = schemaData();
  const index = types[kind];
  return typeof index === "number"
    ? { fields: shapes[index], fingerprint: hashes[index] }
    : undefined;
}
export const nestedFields = (index) => schemaData()[1][index];
export function valueProblems(type, value, path) {
  if (value == null || (typeof value === "string" && value.startsWith("${")))
    return [];
  if (typeof type === "string") {
    if (type === "dynamic") return [];
    return typeof value ===
      { bool: "boolean", number: "number", string: "string" }[type]
      ? []
      : [path + " · " + type + " 값이 필요합니다."];
  }
  const [mode, child] = type;
  if (["list", "set", "tuple"].includes(mode) && !Array.isArray(value))
    return [path + " · 배열을 입력하세요."];
  if (
    ["map", "object", "single", "group"].includes(mode) &&
    (typeof value !== "object" || Array.isArray(value))
  )
    return [path + " · 객체를 입력하세요."];
  const entries =
    mode === "single" || mode === "group"
      ? [["", value]]
      : Object.entries(value);
  return entries.flatMap(([key, v]) => {
    const name = key === "" ? path : path + "." + key;
    if (typeof child === "number")
      return fieldProblems(nestedFields(child), v, name);
    const subtype = ["tuple", "object"].includes(mode) ? child[key] : child;
    return subtype ? valueProblems(subtype, v, name) : [];
  });
}
export function fieldProblems(fields, args, path = "") {
  if (!args || typeof args !== "object" || Array.isArray(args))
    return [path + " · 객체를 입력하세요."];
  return Object.entries(fields).flatMap(([key, [type, required]]) => {
    const name = path ? path + "." + key : key;
    return args[key] == null
      ? required
        ? [name + " · 필수 속성"]
        : []
      : valueProblems(type, args[key], name);
  });
}
export function argumentReferences(value, path = "", out = []) {
  if (typeof value === "string") {
    for (const match of value.matchAll(
      /(?<!\$)\$\{([\w-]+\.n_[\w]+)\.[\w-]+\}/g,
    ))
      out.push({ path, address: match[1] });
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value))
      argumentReferences(nested, path ? path + "." + key : key, out);
  }
  return out;
}
// Only bindings with an explicit semantic target are offered for diagram connections.
/** @type {Record<string,string[]>} */
export const referenceTargets = {
  parent_id: ["azurerm_resource_group", "id"],
  vpc_id: ["aws_vpc", "id"],
  subnet_id: ["aws_subnet", "id"],
  security_group_id: ["aws_security_group", "id"],
  resource_group_name: ["azurerm_resource_group", "name"],
  virtual_network_name: ["azurerm_virtual_network", "name"],
  virtual_network_id: ["azurerm_virtual_network", "id"],
  network: ["google_compute_network", "id"],
  subnetwork: ["google_compute_subnetwork", "id"],
};
export function compatibleFields(kind, targetKind) {
  const cloud = (name) =>
    /^(?:aws|awscc)_/.test(name)
      ? "AWS"
      : /^(?:azurerm|arm|azapi|azuread)_/.test(name)
        ? "Azure"
        : /^(?:beta_)?google_/.test(name)
          ? "GCP"
          : "";
  if (!cloud(kind) || cloud(kind) !== cloud(targetKind)) return [];
  const fields = resourceSchema(kind)?.fields || {};
  return Object.keys(fields).filter((key) => {
    if (key === "parent_id") {
      if (!kind.startsWith("arm_")) return false;
      const arm = kind.slice(4),
        parent = arm.slice(0, arm.lastIndexOf("/"));
      const nested = parent.includes("/");
      return nested
        ? targetKind === "arm_" + parent
        : [
            "microsoft.storage/storageaccounts",
            "microsoft.network/virtualnetworks",
            "microsoft.compute/virtualmachines",
          ].includes(arm) && targetKind === "azurerm_resource_group";
    }
    const target =
      key === "subnet_id" && kind.startsWith("azurerm_")
        ? "azurerm_subnet"
        : referenceTargets[key]?.[0];
    return (
      target &&
      target === targetKind.replace(/^beta_/, "") &&
      fields[key][0] === "string"
    );
  });
}
