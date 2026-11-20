const actions = new Map([
  ["create", "생성"],
  ["update", "수정"],
  ["delete", "삭제"],
  ["delete,create", "교체"],
  ["create,delete", "교체"],
  ["read", "조회"],
  ["no-op", "변경 없음"],
  ["forget", "관리 해제"],
]);
const marked = (mask) =>
  mask === true ||
  Boolean(mask && typeof mask === "object" && Object.values(mask).some(marked));
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const display = (value) =>
  value === undefined ? "없음" : JSON.stringify(value);

// Terraform quoted instance keys may contain brackets, dots and escaped quotes.
const indexSuffix = /\[(?:\d+|"(?:\\.|[^"\\])*")\]$/;
function addressParts(address) {
  const module =
    address.match(
      /^(?:module\.[\w-]+(?:\[(?:\d+|"(?:\\.|[^"\\])*")\])?\.)+/,
    )?.[0] || "";
  const local = address.slice(module.length);
  const index = local.match(indexSuffix)?.[0] || "";
  return {
    module: module.slice(0, -1),
    declaration: local.slice(0, local.length - index.length),
    index,
  };
}
function pathLabel(path) {
  return path
    .map((part, i) =>
      typeof part === "number"
        ? "[" + part + "]"
        : /^[a-zA-Z_][\w-]*$/.test(part)
          ? (i ? "." : "") + part
          : "[" + JSON.stringify(part) + "]",
    )
    .join("");
}

export function reviewPlan(plan) {
  if (
    !object(plan) ||
    !/^1\.\d+$/.test(plan.format_version) ||
    !(
      Array.isArray(plan.resource_changes) ||
      (plan.resource_changes === undefined && object(plan.planned_values))
    )
  )
    throw Error("지원되는 Terraform/OpenTofu plan JSON을 선택하세요.");
  return (plan.resource_changes || []).map((item) => {
    const change = item?.change;
    if (
      typeof item?.address !== "string" ||
      !Array.isArray(change?.actions) ||
      !change.actions.every((a) => typeof a === "string")
    )
      throw Error("리소스 변경 항목을 읽을 수 없습니다.");
    const replaced = Array.isArray(change.replace_paths)
      ? change.replace_paths.filter(
          (path) =>
            Array.isArray(path) &&
            path.every((p) => typeof p === "string" || Number.isInteger(p)),
        )
      : [];
    const pathsFor = (key) => replaced.filter((path) => path[0] === key);
    const fields = [];
    const keys = new Set(
      [change.before, change.after, change.after_unknown].flatMap((v) =>
        object(v) ? Object.keys(v) : [],
      ),
    );
    for (const path of replaced)
      if (typeof path[0] === "string") keys.add(path[0]);
    for (const key of keys) {
      const hidden = [change.before_sensitive, change.after_sensitive].some(
        (mask) => mask === true || marked(mask?.[key]),
      );
      const unknown =
        change.after_unknown === true || marked(change.after_unknown?.[key]);
      const before = change.before?.[key],
        after = change.after?.[key];
      if (
        !pathsFor(key).length &&
        !unknown &&
        JSON.stringify(before) === JSON.stringify(after)
      )
        continue;
      fields.push({
        key,
        replacementPaths: [
          ...new Set(
            pathsFor(key).map((path) => (hidden ? key : pathLabel(path))),
          ),
        ],
        before: hidden ? "민감 값" : display(before),
        after: hidden ? "민감 값" : unknown ? "적용 후 결정" : display(after),
      });
    }
    return {
      address: item.address,
      ...addressParts(item.address),
      reason: typeof item.action_reason === "string" ? item.action_reason : "",
      wholeReplacement: replaced.some((path) => path.length === 0),
      action: actions.get(change.actions.join(",")) || "기타",
      fields,
    };
  });
}

// Only a root instance index may be stripped. Never match a child module to a root declaration.
export function planNode(address, nodes) {
  const base = address.replace(indexSuffix, "");
  return nodes.find((n) => (n.address || n.kind + "." + n.id) === base)?.id;
}

// A module call represents its instances on the declaration-level canvas.
export function planModuleTarget(row, model) {
  const firstCall = row.module.match(/^module\.[\w-]+/)?.[0];
  if (!firstCall) return;
  const call = model.nodes.find(
    (n) => n.kind === "module" && n.address === firstCall,
  );
  if (!call) return;
  const direct = row.module.replace(indexSuffix, "") === firstCall;
  const source =
    direct &&
    call.moduleDirectory &&
    model.sources.find(
      (f) =>
        f.name.includes("/") &&
        f.name.slice(0, f.name.lastIndexOf("/")) === call.moduleDirectory &&
        f.preservedDeclarations?.includes(row.declaration),
    );
  return { id: call.id, address: call.address, file: source?.name };
}
