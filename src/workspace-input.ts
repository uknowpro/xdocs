import { marked } from "marked";
import { parentHeader } from "../shared/page-parent.mjs";
import { pageKind } from "../shared/page-kind.mjs";
import { decodeWorkbook, LIMITS } from "../shared/tabular.mjs";
import {
  decodeArchitecture,
  generateArchitecture,
  terraformAddress,
} from "../shared/architecture.mjs";
import type { ArchitectureModel } from "./ArchitectureDocument";
import type { Note } from "./types";
import type { InputFile } from "./xcode-session";

export type Selection =
  | { kind: "note" }
  | { kind: "sheets"; sheet: string; range: string }
  | { kind: "architecture"; resource: string };
export type WorkspaceOrigin = {
  page: string;
  revision: string;
  selection: Selection;
};
export type TextInput = Extract<InputFile, { text: string }>;
export type WorkspaceAccess = {
  notes: Note[];
  read: (id: string) => Promise<Note>;
  save: (note: Note, body: string) => Promise<void>;
  open: (origin: WorkspaceOrigin, cited?: string) => Promise<void>;
};
type Book = {
  sheets: {
    id: string;
    name: string;
    rows: string[][];
    firstRowHeader?: boolean;
  }[];
};
export const workbook = (note: Note) =>
  decodeWorkbook(note.body) as Book | null;
export const architecture = (note: Note) =>
  decodeArchitecture(note.body) as ArchitectureModel | null;
export function coordinates(address: string) {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(address);
  if (!match) return;
  let column = 0;
  for (const c of match[1]) column = column * 26 + c.charCodeAt(0) - 64;
  return [column, Number(match[2])] as const;
}
export function columnName(n: number): string {
  return n > 26
    ? columnName(Math.floor((n - 1) / 26)) + columnName(((n - 1) % 26) + 1)
    : String.fromCharCode(n + 64);
}

// Imported pages carry the parser-confirmed opening line. Stop at its matching
// brace even when nested blocks, strings, comments or heredocs contain braces.
function hclDeclaration(text: string, line: number, address: string) {
  const input = text
    .split("\n")
    .slice(line - 1)
    .join("\n");
  const header =
    /^\s*(resource|data|module)\s+"([^"]+)"(?:\s+"([^"]+)")?\s*\{/.exec(input);
  if (!header) return;
  const [, kind, type, name] = header;
  const blockAddress =
    kind === "module"
      ? "module." + type
      : (kind === "data" ? "data." : "") + type + "." + name;
  if (blockAddress !== address) return;
  let depth = 1;
  for (let i = header[0].length; i < input.length; i++) {
    const c = input[i],
      pair = input.slice(i, i + 2);
    if (c === '"') {
      while (++i < input.length && input[i] !== '"') if (input[i] === "\\") i++;
    } else if (c === "#" || pair === "//") {
      i = input.indexOf("\n", i);
      if (i < 0) return;
    } else if (pair === "/*") {
      const end = input.indexOf("*/", i + 2);
      if (end < 0) return;
      i = end + 1;
    } else if (pair === "<<") {
      const marker = /^<<(-?)([\w-]+)[ \t]*\r?\n/.exec(input.slice(i));
      if (marker) {
        const delimiter = new RegExp(
          "^" + (marker[1] ? "[ \t]*" : "") + marker[2] + "[ \t]*\r?$",
          "gm",
        );
        delimiter.lastIndex = i + marker[0].length;
        const end = delimiter.exec(input);
        if (!end) return;
        i = end.index + end[0].length - 1;
      }
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0)
      return input.slice(0, i + 1).trimStart();
  }
}
function resourceText(model: ArchitectureModel, id: string) {
  const n = model.nodes.find((node) => node.id === id);
  if (!n) throw Error("선택했던 리소스를 찾을 수 없습니다.");
  const address = n.address || terraformAddress(n);
  const { files } = generateArchitecture(model, "terraform", [id]);
  const parts = [n.label + " · " + address];
  for (const [path, text] of Object.entries(files)) {
    if (
      n.sourceFile &&
      path !== "terraform/" + n.sourceFile &&
      !path.endsWith("/zz_xdocs_override.tf.json")
    )
      continue;
    if (path.endsWith(".tf.json")) {
      const json = JSON.parse(text),
        [first, second, third] = address.split(".");
      const decl =
        first === "module"
          ? json.module?.[second]
          : first === "data"
            ? json.data?.[second]?.[third]
            : json.resource?.[first]?.[second];
      if (decl !== undefined) {
        const declaration =
          first === "module"
            ? { module: { [second]: decl } }
            : first === "data"
              ? { data: { [second]: { [third]: decl } } }
              : { resource: { [first]: { [second]: decl } } };
        parts.push(path + "\n" + JSON.stringify(declaration, null, 2));
      }
    } else if (path.endsWith(".tf") && n.sourceLine) {
      const block = hclDeclaration(text, n.sourceLine, address);
      if (block) parts.push(path + "\n" + block);
    }
  }
  if (parts.length === 1) parts.push("Terraform 선언 없음");
  return parts.join("\n\n");
}
export function snapshot(note: Note, selection: Selection): TextInput {
  if (pageKind(note) !== selection.kind)
    throw Error("페이지 종류가 바뀌었습니다.");
  let text = "";
  const name = note.title;
  const sources: NonNullable<TextInput["sources"]> = [];
  if (selection.kind === "note") text = note.body.replace(parentHeader, "");
  if (selection.kind === "architecture")
    text = resourceText(architecture(note)!, selection.resource);
  if (selection.kind === "sheets") {
    const sheet = workbook(note)?.sheets.find((s) => s.id === selection.sheet);
    if (!sheet) throw Error("시트를 찾을 수 없습니다.");
    const addresses = selection.range.toUpperCase().trim().split(":");
    const a = coordinates(addresses[0]),
      b = coordinates(addresses[1] ?? addresses[0]);
    if (
      addresses.length > 2 ||
      !a ||
      !b ||
      a[0] > b[0] ||
      a[1] > b[1] ||
      b[0] > LIMITS.columns ||
      b[1] > sheet.rows.length ||
      b[0] > Math.max(0, ...sheet.rows.map((r) => r.length)) ||
      (b[0] - a[0] + 1) * (b[1] - a[1] + 1) > 10000
    )
      throw Error("시트 안에서 최대 1만 셀의 범위를 입력하세요. 예: B2:D12");
    text = sheet.name + "\n";
    for (let row = a[1]; row <= b[1]; row++)
      for (let col = a[0]; col <= b[0]; col++) {
        const cell = columnName(col) + row,
          value = sheet.rows[row - 1]?.[col - 1] ?? "";
        text += cell + "=";
        sources.push({
          place: sheet.name + "!" + cell,
          start: text.length,
          length: value.length,
        });
        text += value + (col === b[0] ? "\n" : "\t");
      }
  }
  if (!text.trim() || text.length > 160000)
    throw Error("비어 있지 않은 16만 자 이하의 자료를 선택하세요.");
  return {
    name,
    text,
    sources,
    workspace: { page: note.id, revision: note.revision, selection },
  };
}
export function noteBlocks(body: string) {
  const header = body.match(parentHeader)?.[0] || "";
  const content = body.slice(header.length);
  const normalized = content.replace(/\r\n?/g, "\n");
  const offsets = [header.length];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\r" && content[i + 1] === "\n") i++;
    offsets.push(header.length + i + 1);
  }
  let cursor = 0;
  const blocks = [];
  for (const t of marked.lexer(normalized)) {
    const start = normalized.indexOf(t.raw, cursor);
    if (start < 0) continue;
    cursor = start + t.raw.length;
    if (t.type === "space" || !t.raw.trim()) continue;
    blocks.push({
      start: offsets[start],
      end: offsets[cursor],
      text: t.raw.trimEnd(),
    });
  }
  return blocks;
}
