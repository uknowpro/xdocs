import path from "node:path";
import { open, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parseAllDocuments } from "yaml";

const sessions = new Map();

// Helm puts the chart-relative origin after the YAML document separator.
// Template expansion does not preserve original line numbers.
export function helmOrigins(yaml) {
  const documents = parseAllDocuments(yaml);
  return documents.map((doc) => {
    const block = yaml.slice(doc.range[0], doc.range[2]);
    const file = /^(?:---[^\S\n]*\r?\n)?# Source: [^/\r\n]+\/(.+)\r?$/m
      .exec(block)?.[1]
      ?.trim();
    return {
      file,
      name: doc.getIn(["metadata", "name"]),
      kind: doc.get("kind"),
    };
  });
}

export function traceSources(raw, root, origins) {
  const files = new Map();
  const session = randomUUID();
  function trace(e) {
    if (!e || typeof e.file !== "string") return;
    let file = e.file;
    let line = Number.isSafeInteger(e.line) && e.line > 0 ? e.line : null;
    if (origins) {
      const index = /^documents\[(\d+)\]/.exec(e.reference || "")?.[1];
      const matches =
        index != null
          ? [origins[Number(index)]]
          : origins.filter(
              (d) =>
                d.name === e.target && String(d.kind).toLowerCase() === e.kind,
            );
      if (matches.length !== 1 || !matches[0]?.file) return;
      file = matches[0].file;
      if (!/(?:^|\/)templates\//.test(file)) return;
      line = null;
    }
    if (path.isAbsolute(file)) file = path.relative(root, file);
    if (
      !file ||
      path.isAbsolute(file) ||
      file.split(/[\\/]/).some((p) => p === "..")
    )
      return;
    files.set(file, true);
    e.source = { session, file, line, template: Boolean(origins) };
  }
  for (const f of raw.findings || raw.report?.findings || []) trace(f);
  for (const c of raw.connections || [])
    for (const e of c.evidence || []) trace(e);
  if (sessions.size >= 12) sessions.delete(sessions.keys().next().value);
  sessions.set(session, { root, files });
  return raw;
}

export async function readAnalyzerSource({ session, file }) {
  const scan = sessions.get(session);
  if (!scan?.files.has(file)) throw Error("폴더를 다시 분석해 원본을 여세요.");
  const root = await realpath(scan.root);
  const target = await realpath(path.join(root, file));
  const relative = path.relative(root, target);
  if (
    !relative ||
    relative.split(path.sep)[0] === ".." ||
    path.isAbsolute(relative)
  )
    throw Error("선택한 프로젝트 외부의 파일입니다.");
  const handle = await open(target, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 2 * 1024 * 1024)
      throw Error("2MB 이하의 원본 텍스트 파일만 열 수 있습니다.");
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}
