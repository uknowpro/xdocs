import { pageKind } from "../shared/page-kind.mjs";
import { isReviewSlot, reviewSlots, type ReviewSlot } from "./xcode-checkpoint";
import type { Note } from "./types";

const limit = 48 * 1024 * 1024;
type Ref = { id: string; path: string };
type TemplateData = { name: string; content: string };
type Backup = {
  format: "xdocs-review-backup";
  version: 1;
  notes: Ref[];
  entries: ReviewSlot[];
};
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
const string = (value: unknown): value is string => typeof value === "string";
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(string);
const fields = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (v) => object(v) && string(v.id) && string(v.label) && string(v.original),
  );
const fieldsReview = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (v) =>
      object(v) &&
      string(v.id) &&
      string(v.label) &&
      string(v.original) &&
      typeof v.included === "boolean" &&
      typeof v.approved === "boolean" &&
      string(v.reason) &&
      strings(v.sources),
  );
const note = (
  value: unknown,
): value is Record<string, unknown> & { id: string } =>
  object(value) &&
  string(value.id) &&
  string(value.title) &&
  string(value.path) &&
  string(value.body) &&
  string(value.revision);
async function encodeTemplate(file: File): Promise<TemplateData> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { name: file.name, content: btoa(binary) };
}
export async function exportReviewBackup(scope: string, notes: Note[]) {
  const available = new Set(
    notes.filter((n) => pageKind(n) === "xcode").map((n) => n.id),
  );
  const entries = await Promise.all(
    (await reviewSlots(scope))
      .filter((entry) => available.has(entry.session))
      .map(async (entry) =>
        entry.slot === "office-template" && entry.value instanceof File
          ? { ...entry, value: await encodeTemplate(entry.value) }
          : entry,
      ),
  );
  const backup: Backup = {
    format: "xdocs-review-backup",
    version: 1,
    notes: notes.map(({ id, path }) => ({ id, path })),
    entries,
  };
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  if (blob.size > limit) throw Error("검토 백업이 48MB 한도를 초과했습니다.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "xdocs-review-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return entries.length;
}
function remapValue(
  slot: string,
  value: unknown,
  map: Map<string, string>,
): unknown {
  if (slot === "office-draft/latest")
    return string(value) && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
  if (!object(value)) return undefined;
  if (slot === "office-template") {
    if (
      !string(value.name) ||
      !/^[^/\\]+\.(?:docx|xlsx)$/i.test(value.name) ||
      !string(value.content) ||
      value.content.length > 11_184_812
    )
      return undefined;
    const decoded = atob(value.content);
    return new File(
      [Uint8Array.from(decoded, (c) => c.charCodeAt(0))],
      value.name,
    );
  }
  if (slot.startsWith("note-application/")) {
    if (
      !string(value.id) ||
      slot !== "note-application/" + value.id ||
      !string(value.page) ||
      !string(value.before) ||
      !string(value.after) ||
      !string(value.title) ||
      !string(value.date) ||
      !Number.isInteger(value.turn) ||
      !["pending","applied","undone","conflict"].includes(String(value.state)) ||
      (value.citations !== undefined && !strings(value.citations))
    )
      return undefined;
    const page = map.get(value.page);
    return page ? { ...value, page } : undefined;
  }
  if (slot === "application-draft") {
    if (
      !object(value.origin) ||
      !string(value.origin.answer) ||
      !Number.isInteger(value.origin.turn) ||
      !string(value.answer) ||
      !string(value.id) ||
      !Number.isInteger(value.block) ||
      !Array.isArray(value.proposals) ||
      (value.baseline !== undefined && !note(value.baseline))
    )
      return undefined;
    if (
      !value.proposals.every(
        (p) =>
          object(p) &&
          note(p.note) &&
          string(p.body) &&
          string(p.answer) &&
          typeof p.checked === "boolean" &&
          Number.isInteger(p.block),
      )
    )
      return undefined;
    const proposals = value.proposals.flatMap((p) => {
      const id = map.get(p.note.id);
      return id ? [{ ...p, note: { ...p.note, id } }] : [];
    });
    const id = value.id ? map.get(value.id) : "";
    return {
      ...value,
      id: id || "",
      baseline:
        id && note(value.baseline) ? { ...value.baseline, id } : undefined,
      proposals,
    };
  }
  if (slot.startsWith("office-draft/")) {
    if (
      !string(value.identity) ||
      slot !== "office-draft/" + value.identity ||
      !string(value.form) ||
      !string(value.json) ||
      !fields(value.fields) ||
      !object(value.values) ||
      !object(value.sources) ||
      !object(value.conflicts) ||
      !Array.isArray(value.files) ||
      !strings(value.accepted) ||
      (value.preview !== undefined && !fieldsReview(value.preview))
    )
      return undefined;
    const files = value.files.filter(
      (f) =>
        object(f) &&
        string(f.name) &&
        string(f.text) &&
        (f.sources === undefined ||
          (Array.isArray(f.sources) &&
            f.sources.every(
              (s) =>
                object(s) &&
                string(s.place) &&
                Number.isInteger(s.start) &&
                Number.isInteger(s.length),
            ))),
    );
    if (
      !Object.values(value.sources).every(strings) ||
      !Object.values(value.conflicts).every(string) ||
      !Object.values(value.values).every((item) =>
        ["string", "boolean", "number"].includes(typeof item),
      )
    )
      return undefined;
    return { ...value, files };
  }
  if (
    !string(value.form) ||
    !string(value.identity) ||
    !string(value.reviewedAt) ||
    !fieldsReview(value.fields)
  )
    return undefined;
  return value;
}
export async function inspectReviewBackup(
  scope: string,
  notes: Note[],
  file: File,
) {
  if (file.size > limit) throw Error("48MB 이하 검토 백업을 선택하세요.");
  const backup: unknown = JSON.parse(await file.text());
  if (
    !object(backup) ||
    backup.format !== "xdocs-review-backup" ||
    backup.version !== 1 ||
    !Array.isArray(backup.notes) ||
    !Array.isArray(backup.entries) ||
    backup.entries.length > 20000
  )
    throw Error("지원하는 xdocs 검토 백업 파일이 아닙니다.");
  const byId = new Map(notes.map((n) => [n.id, n]));
  const byPath = new Map(notes.map((n) => [n.path, n]));
  const map = new Map<string, string>();
  for (const ref of backup.notes) {
    if (!object(ref) || !string(ref.id) || !string(ref.path)) continue;
    const target = byId.get(ref.id) || byPath.get(ref.path);
    if (target) map.set(ref.id, target.id);
  }
  const existing = new Set(
    (await reviewSlots(scope)).map((e) => JSON.stringify([e.session, e.slot])),
  );
  const unique = new Set<string>();
  let duplicates = 0,
    missing = 0;
  const entries: ReviewSlot[] = [];
  for (const item of backup.entries) {
    if (
      !object(item) ||
      !string(item.session) ||
      !string(item.slot) ||
      !isReviewSlot(item.slot)
    )
      throw Error("올바르지 않은 검토 백업 항목입니다.");
    const session = map.get(item.session);
    const note = session && byId.get(session);
    if (!session || !note || pageKind(note) !== "xcode") {
      missing++;
      continue;
    }
    const key = JSON.stringify([session, item.slot]);
    if (existing.has(key) || unique.has(key)) {
      duplicates++;
      continue;
    }
    const value = remapValue(item.slot, item.value, map);
    if (value === undefined) {
      missing++;
      continue;
    }
    unique.add(key);
    entries.push({ session, slot: item.slot, value });
  }
  return { entries, duplicates, missing };
}
