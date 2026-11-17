import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Workflow,
  Plus,
} from "lucide-react";
import type { Note } from "./types";
import { isCanvas } from "./canvasPreview";
import { templates } from "../shared/workflows.mjs";
import { parentHeader } from "../shared/page-parent.mjs";
type Entry = {
  key: string;
  name: string;
  page?: Note;
  parent?: Entry;
  children: Entry[];
};
function tree(notes: Note[]) {
  const root: Entry = { key: "", name: "", children: [] },
    folders = new Map([["", root]]);
  const pages = new Map<string, Entry>(
    notes.map((page) => [
      page.id,
      { key: "p:" + page.id, name: page.title, page, children: [] },
    ]),
  );
  for (const page of notes) {
    let path = "",
      dir = root;
    for (const segment of page.path
      .split(/[\\/]/)
      .slice(0, -1)
      .filter(Boolean)) {
      path += "/" + segment;
      if (!folders.has(path)) {
        const f = {
          key: "f:" + path,
          name: segment,
          parent: dir,
          children: [],
        };
        folders.set(path, f);
        dir.children.push(f);
      }
      dir = folders.get(path)!;
    }
    const entry = pages.get(page.id)!;
    const id = page.body.match(parentHeader)?.[1];
    let parent = id ? pages.get(id) : undefined;
    for (let n = parent; n; n = n.parent) {
      if (n === entry) {
        parent = undefined;
        break;
      }
    }
    entry.parent = parent || dir;
    entry.parent.children.push(entry);
  }
  return { root, pages };
}
export type PageKind = "note" | "architecture" | keyof typeof templates;
export default function PageTree({
  notes,
  active,
  readonly,
  onOpen,
  onCreate,
}: {
  notes: Note[];
  active: string;
  readonly: boolean;
  onOpen: (id: string) => void;
  onCreate: (parent: string, kind: PageKind) => void;
}) {
  const { root, pages } = useMemo(() => tree(notes), [notes]);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const limit = 100;
  const [menu, setMenu] = useState("");
  const activePath = useMemo(() => {
    const chain = [];
    for (let n = pages.get(active)?.parent; n && n !== root; n = n.parent)
      chain.push(n.key);
    return JSON.stringify(chain);
  }, [pages, root, active]);
  useEffect(() => {
    setMenu("");
    setClosed((prev) => {
      const next = new Set(prev);
      for (const key of JSON.parse(activePath)) next.delete(key);
      return next;
    });
  }, [active, activePath]);
  const rows: { entry: Entry; depth: number }[] = [];
  const stack = root.children.map((entry) => ({ entry, depth: 0 })).reverse();
  while (stack.length) {
    const row = stack.pop()!;
    rows.push(row);
    if (!closed.has(row.entry.key))
      for (let i = row.entry.children.length - 1; i >= 0; i--)
        stack.push({ entry: row.entry.children[i], depth: row.depth + 1 });
  }
  const idx = rows.findIndex((r) => r.entry.page?.id === active);
  const [page, setPage] = useState(0);
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / limit) - 1),
  );
  useEffect(() => {
    if (idx >= 0) setPage(Math.floor(idx / limit));
  }, [active, idx, limit]);
  function toggle(key: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  return (
    <nav className="note-list page-tree" aria-label="보관함 페이지">
      {rows
        .slice(current * limit, (current + 1) * limit)
        .map(({ entry: e, depth }) => {
          const n = e.page,
            open = !closed.has(e.key),
            Icon = n ? (isCanvas(n) ? Workflow : FileText) : Folder;
          return (
            <div key={e.key} style={{ paddingLeft: Math.min(depth, 10) * 12 }}>
              <div
                className={"page-row " + (n?.id === active ? "current" : "")}
              >
                {e.children.length > 0 ? (
                  <button
                    className="page-toggle"
                    aria-label={e.name + (open ? " 접기" : " 펼치기")}
                    aria-expanded={open}
                    onClick={() => toggle(e.key)}
                  >
                    {open ? (
                      <ChevronDown size={13} />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                  </button>
                ) : (
                  <span className="page-toggle" />
                )}
                <button
                  className="nav-item note-item"
                  title={
                    n
                      ? (isCanvas(n) ? "캔버스 · " : "노트 · ") + n.path
                      : e.name
                  }
                  aria-current={n?.id === active ? "page" : undefined}
                  onClick={() => (n ? onOpen(n.id) : toggle(e.key))}
                >
                  <Icon size={15} />
                  <span>{e.name}</span>
                </button>
                {n && !readonly && (
                  <button
                    className="page-add"
                    aria-expanded={menu === n.id}
                    aria-label={e.name + " 하위 페이지 추가"}
                    onClick={() => setMenu(menu === n.id ? "" : n.id)}
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>
              {n && menu === n.id && (
                <select
                  autoFocus
                  className="nav-item"
                  aria-label="하위 페이지 유형"
                  value=""
                  onChange={(e) => {
                    const kind = e.target.value as PageKind;
                    if (kind) {
                      setMenu("");
                      onCreate(n.id, kind);
                    }
                  }}
                >
                  <option value="">하위 페이지 유형 선택</option>
                  <option value="note">노트</option>
                  <option value="architecture">IaCD 아키텍처</option>
                  {Object.entries(templates).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      {!notes.length && (
        <p className="sidebar-empty">첫 페이지를 만들어 보세요.</p>
      )}
      {rows.length > limit && (
        <div className="sheet-pages">
          <button disabled={!current} onClick={() => setPage(current - 1)}>
            이전
          </button>
          <span>
            {current + 1} / {Math.ceil(rows.length / limit)}
          </span>
          <button
            disabled={(current + 1) * limit >= rows.length}
            onClick={() => setPage(current + 1)}
          >
            다음
          </button>
        </div>
      )}
    </nav>
  );
}
