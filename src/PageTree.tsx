import { useEffect, useMemo, useState, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Workflow,
  Plus,
  MoreHorizontal,
  Table2,
  Terminal,
  Blocks,
  ScanSearch,
  Network,
  Layers,
  GitBranch,
  Boxes,
  Cloud,
  ListTree,
} from "lucide-react";
import type { Note } from "./types";
import { pageKind } from "../shared/page-kind.mjs";
import { isCanvas } from "./canvasPreview";
import { templates } from "../shared/workflows.mjs";
import {
  isFolderPage,
  orderBetween,
  pageOrder,
  withParent,
  parentHeader,
} from "../shared/page-parent.mjs";
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
    entry.parent = parent || (id === "@" ? root : dir);
    entry.parent.children.push(entry);
  }
  for (const group of [...folders.values(), ...pages.values()])
    group.children.sort((a, b) => {
      if (!a.page || !b.page)
        return (
          Number(!!a.page) - Number(!!b.page) || a.name.localeCompare(b.name)
        );
      const x = pageOrder(a.page),
        y = pageOrder(b.page);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  return { root, pages };
}
const icons: Record<string, typeof FileText> = {
  note: FileText,
  sheets: Table2,
  folder: Folder,
  xcode: Terminal,
  analyzer: ScanSearch,
  builder: Blocks,
  infra: Network,
  architecture: Layers,
  workflow: Workflow,
  actions: GitBranch,
  ansible: ListTree,
  jenkins: Boxes,
  cloudformation: Cloud,
};
export type PageKind =
  | "xcode"
  | "analyzer"
  | "builder"
  | "folder"
  | "sheet"
  | "note"
  | "architecture"
  | keyof typeof templates;
export default function PageTree({
  notes,
  active,
  readonly,
  onOpen,
  onCreate,
  onMove,
  onRename,
  onTrash,
  onFolderNote,
}: {
  notes: Note[];
  active: string;
  readonly: boolean;
  onFolderNote: (parent?: string, directory?: string) => void;
  onTrash: (name: string, notes: Note[], folder: boolean) => void;
  onRename: (note: Note) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, expected: string, next: string) => Promise<boolean>;
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
  const [moving, setMoving] = useState(""),
    [message, setMessage] = useState(""),
    [undo, setUndo] = useState<{
      id: string;
      before: string;
      after: string;
    } | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!moving) return;
    const dismiss = (ev: Event) => {
      if (!(
        ev.target instanceof Element &&
        ev.target.closest(".page-popup,.page-add")
      ))
        setMoving("");
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", dismiss);
    };
  }, [moving]);
  const lock = useRef(false);
  function allowed(source: Entry, target: Entry) {
    for (let n: Entry | undefined = target; n; n = n.parent)
      if (n === source) return false;
    return true;
  }
  async function savePosition(
    id: string,
    before: string,
    after: string,
    revert = false,
  ) {
    if (lock.current || readonly || before === after) return;
    lock.current = true;
    try {
      if (await onMove(id, before, after)) {
        setUndo(revert ? null : { id, before, after });
        setMoving("");
        setMessage("");
      }
    } catch (err) {
      setMessage(String(err));
    } finally {
      lock.current = false;
    }
  }
  function place(source: Entry, dest: Entry, index: number) {
    if (!source.page || source.page.role === "reader" || !allowed(source, dest))
      return;
    const siblings = dest.children.filter((n) => n.page && n !== source);
    const parent = dest.page?.id ?? (dest === root ? "@" : "");
    try {
      const order = orderBetween(
        siblings[index - 1]?.page && pageOrder(siblings[index - 1].page),
        siblings[index]?.page && pageOrder(siblings[index].page),
      );
      void savePosition(
        source.page.id,
        source.page.body.match(parentHeader)?.[0] || "",
        withParent(parent, "", order),
      );
    } catch (err) {
      setMessage(String(err));
    }
  }
  function append(source: Entry, dest: Entry) {
    place(
      source,
      dest,
      dest.children.filter((n) => n.page && n !== source).length,
    );
  }
  function step(source: Entry, delta: number) {
    const parent = source.parent!,
      siblings = parent.children.filter((n) => n.page),
      index = siblings.indexOf(source) + delta;
    if (index >= 0 && index < siblings.length) place(source, parent, index);
  }
  return (
    <nav className="note-list page-tree" aria-label="보관함 페이지">
      {rows
        .slice(current * limit, (current + 1) * limit)
        .map(({ entry: e, depth }) => {
          const n = e.page,
            open = !closed.has(e.key),
            folder = !n || isFolderPage(n),
            Icon = folder ? Folder : icons[pageKind(n!)] || FileText;
          return (
            <div key={e.key} style={{ paddingLeft: Math.min(depth, 10) * 12 }}>
              <div
                onDragLeave={(ev) => {
                  if (!ev.currentTarget.contains(ev.relatedTarget as Node))
                    delete ev.currentTarget.dataset.drop;
                }}
                onDragEnd={() =>
                  document
                    .querySelectorAll(".page-row[data-drop]")
                    .forEach((el) => el.removeAttribute("data-drop"))
                }
                onDragStart={(ev) => {
                  if (n)
                    ev.dataTransfer.setData("application/x-xdocs-page", n.id);
                }}
                onDragOver={(ev) => {
                  if (
                    n &&
                    !readonly &&
                    ev.dataTransfer.types.includes("application/x-xdocs-page")
                  ) {
                    ev.preventDefault();
                    const rect = ev.currentTarget.getBoundingClientRect(),
                      ratio = (ev.clientY - rect.top) / rect.height;
                    ev.currentTarget.dataset.drop =
                      ratio < 0.23
                        ? "before"
                        : ratio > 0.77
                          ? "after"
                          : "inside";
                  }
                }}
                onDrop={(ev) => {
                  ev.preventDefault();
                  const source = pages.get(
                    ev.dataTransfer.getData("application/x-xdocs-page"),
                  );
                  const mode = ev.currentTarget.dataset.drop;
                  delete ev.currentTarget.dataset.drop;
                  if (!source || source === e || !n || readonly) return;
                  if (mode === "before" || mode === "after") {
                    const dest = e.parent!;
                    if (dest.key.startsWith("f:") && dest !== source.parent) {
                      setMessage(
                        "파일 폴더 사이에서는 대상 페이지 안으로 끌어 이동하세요.",
                      );
                      return;
                    }
                    const index = dest.children
                      .filter((t) => t.page && t !== source)
                      .indexOf(e);
                    place(source, dest, index + Number(mode === "after"));
                  } else append(source, e);
                }}
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
                  draggable={!!n && !readonly && n.role !== "reader"}
                  className="nav-item note-item"
                  title={
                    n
                      ? (isFolderPage(n)
                          ? "폴더 · "
                          : isCanvas(n)
                            ? "캔버스 · "
                            : "노트 · ") + n.path
                      : e.name
                  }
                  aria-current={n?.id === active ? "page" : undefined}
                  onClick={() =>
                    n && !isFolderPage(n) ? onOpen(n.id) : toggle(e.key)
                  }
                >
                  <Icon size={15} />
                  <span>{e.name}</span>
                </button>
                {!readonly && n?.role !== "reader" && (
                  <button
                    className="page-add"
                    title="페이지 메뉴"
                    aria-label={e.name + " 페이지 메뉴"}
                    aria-expanded={moving === e.key}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setPosition({
                        left: Math.max(
                          4,
                          Math.min(innerWidth - 212, rect.right - 190),
                        ),
                        top: Math.max(
                          4,
                          Math.min(innerHeight - 250, rect.bottom + 2),
                        ),
                      });
                      setMenu("");
                      setMoving(moving === e.key ? "" : e.key);
                    }}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                )}
                {!readonly && n?.role !== "reader" && (
                  <button
                    className="page-add"
                    title={folder ? "새 노트" : "하위 페이지 추가"}
                    aria-label={
                      e.name + (folder ? " 새 노트" : " 하위 페이지 추가")
                    }
                    onClick={() => {
                      setMoving("");
                      if (folder)
                        onFolderNote(n?.id, n ? undefined : e.key.slice(3));
                      else if (n) setMenu(menu === n.id ? "" : n.id);
                    }}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              {moving === e.key && (
                <div
                  className="page-move page-popup"
                  role="group"
                  aria-label={e.name + " 작업"}
                  style={position}
                  onKeyDown={(ev) => {
                    if (ev.key === "Escape") {
                      setMoving("");
                      (
                        ev.currentTarget.previousElementSibling?.querySelector(
                          '[aria-expanded="true"].page-add',
                        ) as HTMLElement
                      )?.focus();
                    }
                  }}
                >
                  {n && (
                    <button
                      autoFocus
                      onClick={() => {
                        setMoving("");
                        onRename(n);
                      }}
                    >
                      {folder ? "폴더 이름 변경" : "이름 변경"}
                    </button>
                  )}
                  {n && (
                    <button
                      onClick={() => {
                        setMoving("");
                        setMenu(n.id);
                      }}
                    >
                      하위 페이지 추가
                    </button>
                  )}
                  {n && (
                    <select
                      aria-label="이동할 상위 페이지"
                      value=""
                      onChange={(ev) => {
                        const dest =
                          ev.target.value === "@"
                            ? root
                            : pages.get(ev.target.value);
                        if (dest) append(e, dest);
                      }}
                    >
                      <option value="">다른 페이지 아래로 이동</option>
                      <option value="@">보관함 최상위</option>
                      {Array.from(pages.values())
                        .filter((t) => allowed(e, t))
                        .map((t) => (
                          <option key={t.key} value={t.page!.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  )}
                  {n && (
                    <div>
                      <button
                        disabled={e.parent?.children.find((t) => t.page) === e}
                        onClick={() => step(e, -1)}
                      >
                        위로
                      </button>
                      <button
                        disabled={e.parent?.children.at(-1) === e}
                        onClick={() => step(e, 1)}
                      >
                        아래로
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setMoving("");
                      const items: Note[] = [];
                      const stack = [e];
                      while (stack.length) {
                        const item = stack.pop()!;
                        if (item.page) items.push(item.page);
                        if (folder) stack.push(...item.children);
                      }
                      onTrash(e.name, items.reverse(), folder);
                    }}
                  >
                    휴지통으로 이동
                  </button>
                </div>
              )}
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
                  <option value="folder">폴더</option>
                  <option value="note">노트</option>
                  <option value="sheet">시트 테이블</option>
                  <option value="xcode">xcode 세션</option>
                  <option value="analyzer">Analyzer</option>
                  <option value="builder">Builder</option>
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
      {undo && !readonly && (
        <button
          className="text-button"
          onClick={() =>
            void savePosition(undo.id, undo.after, undo.before, true)
          }
        >
          페이지 이동 실행 취소
        </button>
      )}
      {message && <p role="alert">{message}</p>}
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
