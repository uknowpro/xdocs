import path from "node:path";
import { readdir, realpath } from "node:fs/promises";
import { parse } from "@cdktn/hcl2json";

export async function projectSources(root, read) {
  const base = await realpath(root);
  async function configuration(dir) {
    const folder = path.resolve(base, dir);
    if ((await realpath(folder)) !== folder)
      throw Error("심볼릭 링크로 연결된 모듈은 가져올 수 없습니다.");
    const entries = await readdir(folder, { withFileTypes: true });
    const files = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (
        !entry.isFile() ||
        !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.tf(?:\.json)?$/.test(entry.name)
      )
        continue;
      files.push(
        await read(
          path.join(folder, entry.name),
          path.posix.join(dir, entry.name),
        ),
      );
    }
    return files;
  }
  const files = await configuration(".");
  const dirs = new Set();
  for (const file of files) {
    const parsed = await parseSource(file);
    for (const value of Object.values(parsed.module || {})) {
      const source = first(value)?.source;
      if (localDir(source)) dirs.add(localDir(source));
    }
  }
  for (const dir of dirs) files.push(...(await configuration(dir)));
  return files;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}
function localDir(source) {
  return typeof source === "string" &&
    /^\.\/(?:[A-Za-z0-9_-][\w.-]*\/)*[A-Za-z0-9_-][\w.-]*$/.test(source)
    ? source.slice(2)
    : undefined;
}
export function parseSource(file) {
  return file.name.endsWith(".json")
    ? JSON.parse(file.content)
    : parse(file.name, file.content);
}
export async function attachModuleTraces(model, calls) {
  const definitions = new Map();
  if (
    model.sources.some((f) =>
      /^(?:[^/]*_)?override\.tf(?:\.json)?$/.test(f.name),
    )
  )
    return;
  for (const file of model.sources.filter((f) => f.name.includes("/"))) {
    const dir = path.posix.dirname(file.name);
    const defs = definitions.get(dir) || {
      outputs: new Map(),
      resources: new Map(),
      override: false,
    };
    definitions.set(dir, defs);
    const name = path.posix.basename(file.name);
    if (/^(?:.*_)?override\.tf(?:\.json)?$/.test(name)) {
      defs.override = true;
      continue;
    }
    const parsed = await parseSource(file);
    for (const [output, block] of Object.entries(parsed.output || {})) {
      if (defs.outputs.has(output))
        throw Error("로컬 모듈에 중복 output 선언이 있습니다.");
      defs.outputs.set(output, { file: file.name, value: first(block)?.value });
    }
    for (const [type, items] of Object.entries(parsed.resource || {}))
      for (const id of Object.keys(items))
        defs.resources.set(type + "." + id, file.name);
  }
  for (const node of model.nodes) {
    const match = node.placementValue?.match(
      /^\$\{(module\.[\w-]+)\.([\w-]+)\}$/,
    );
    if (!match) continue;
    const [, address, output] = match;
    const call = calls.get(address);
    if (!call || call.count !== undefined || call.for_each !== undefined)
      continue;
    const defs = definitions.get(localDir(call.source));
    const def = defs?.outputs.get(output);
    if (!def || defs.override) continue;
    const trace = {
      address: address + "." + output,
      file: def.file,
      expression: JSON.stringify(def.value ?? null),
    };
    node.moduleTrace = trace;
    const variable =
      typeof def.value === "string" && def.value.match(/^\$\{var\.([\w-]+)\}$/);
    const value = variable ? call[variable[1]] : def.value;
    const target =
      typeof value === "string" &&
      value.match(/^\$\{([\w-]+\.[\w-]+)\.(?:id|name|self_link)\}$/)?.[1];
    if (!target) continue;
    if (
      variable &&
      model.nodes.some((n) => n.address === target && !n.multipleInstances)
    )
      trace.target = target;
    if (!variable && defs.resources.has(target)) {
      trace.target = address + "." + target;
      trace.targetFile = defs.resources.get(target);
    }
  }
}
