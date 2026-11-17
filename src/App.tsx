import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  HardDrive,
  List,
  Loader2,
  Moon,
  Network,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sun,
  Trash2,
  Upload,
  X,
  Bold,
  Heading2,
  ListTodo,
  Link2,
  Code2,
  Monitor,
  Pencil,
  Eye,
  Copy,
  Building2,
} from "lucide-react";
import { api, isDesktop } from "./api";
import type { Note, Workspace } from "./types";
import { linksIn, resolveLink } from "./model";
import Markdown from "./Markdown";
import Graph from "./Graph";

type Theme = "light" | "gray" | "dark" | "system";
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [active, setActive] = useState("");
  const [body, setBody] = useState("");
  const [view, setView] = useState<"note" | "graph">("note");
  const [edit, setEdit] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("xdocs.theme") as Theme) || "light",
  );
  const [settings, setSettings] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const [status, setStatus] = useState<
    "saved" | "pending" | "saving" | "error"
  >("saved");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const current = useRef<Note | null>(null);
  const draft = useRef("");
  const saving = useRef<Promise<boolean> | null>(null);
  const composing = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const activeNote = workspace?.notes.find((n) => n.id === active);
  const notes = useMemo(() => workspace?.notes || [], [workspace]);
  const outgoing = useMemo(
    () =>
      linksIn(body)
        .map((t) => resolveLink(t, notes))
        .filter((n): n is Note => Boolean(n)),
    [body, notes],
  );
  const backlinks = useMemo(
    () =>
      notes.filter(
        (n) =>
          n.id !== active &&
          linksIn(n.body).some((t) => resolveLink(t, notes)?.id === active),
      ),
    [notes, active],
  );
  const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1]);
  const tags = [
    ...new Set([...body.matchAll(/(?:^|\s)#([^\s#]+)/g)].map((m) => m[1])),
  ].slice(0, 4);

  function select(note: Note | undefined) {
    current.current = note || null;
    draft.current = note?.body || "";
    setActive(note?.id || "");
    setBody(note?.body || "");
    setStatus("saved");
    setError("");
  }
  const update = useCallback(
    (note: Note) =>
      setWorkspace((w) =>
        w
          ? {
              ...w,
              notes: w.notes.some((n) => n.id === note.id)
                ? w.notes.map((n) => (n.id === note.id ? note : n))
                : [...w.notes, note],
            }
          : w,
      ),
    [],
  );
  const flush = useCallback(async (): Promise<boolean> => {
    while (saving.current) {
      if (!(await saving.current)) return false;
    }
    const note = current.current;
    if (!note || draft.current === note.body) return true;
    const nextBody = draft.current;
    setStatus("saving");
    const task = (async () => {
      try {
        const saved = await api.save({
          id: note.id,
          body: nextBody,
          revision: note.revision,
        });
        current.current = saved;
        update(saved);
        setStatus(draft.current === saved.body ? "saved" : "pending");
        setError("");
        return true;
      } catch (e) {
        setStatus("error");
        setError(String(e instanceof Error ? e.message : e));
        return false;
      }
    })();
    saving.current = task;
    const ok = await task;
    saving.current = null;
    if (ok && draft.current !== current.current?.body) return flush();
    return ok;
  }, [update]);
  useEffect(() => {
    api
      .load()
      .then((w) => {
        setWorkspace(w);
        select(w?.notes[0]);
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    localStorage.setItem("xdocs.theme", theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (status !== "pending") return;
    const timer = setTimeout(() => {
      if (!composing.current) void flush();
    }, 700);
    return () => clearTimeout(timer);
  }, [body, status, flush]);
  useEffect(
    () =>
      api.onClose?.(() => {
        void flush().then((ok) => {
          if (ok) api.confirmClose?.();
        });
      }),
    [flush],
  );
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (draft.current !== current.current?.body && current.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSettings(false);
        setExportOpen(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [flush]);
  useEffect(() => {
    if (!searchOpen && !settings) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      const dialog = document.querySelector<HTMLElement>(".dialog");
      dialog?.querySelector<HTMLElement>("input,button")?.focus();
    }, 0);
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const elements = [
        ...document.querySelectorAll<HTMLElement>(
          ".dialog button:not(:disabled), .dialog input",
        ),
      ];
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [searchOpen, settings]);
  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (workspace)
        api
          .search(query)
          .then((r) => {
            if (!ignore) setResults(r);
          })
          .catch((e) => {
            if (!ignore) setError(String(e));
          });
    }, 100);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [query, searchOpen, workspace]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const navigate = async (id: string) => {
    if (!(await flush())) return;
    select(
      current.current?.id === id
        ? current.current
        : notes.find((n) => n.id === id),
    );
    setView("note");
    setSearchOpen(false);
  };
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function openVault() {
    if (!(await flush())) return;
    await action(async () => {
      const w = await api.open();
      if (w) {
        setWorkspace(w);
        select(w.notes[0]);
      }
    });
  }
  async function createNote() {
    if (!(await flush())) return;
    await action(async () => {
      const n = await api.create("새 노트");
      update(n);
      select(n);
      setView("note");
      setEdit(true);
    });
  }
  async function refresh() {
    if (!(await flush())) return;
    await action(async () => {
      const w = await api.refresh();
      setWorkspace(w);
      select(w.notes.find((n) => n.id === active) || w.notes[0]);
      setNotice("보관함과 SQLite 색인을 새로고침했습니다.");
    });
  }
  async function importNotes() {
    if (!(await flush())) return;
    await action(async () => {
      const imported = await api.importMarkdown();
      if (imported.length) {
        const w = await api.refresh();
        setWorkspace(w);
        select(w.notes.find((n) => n.id === imported[0].id));
        setNotice(`${imported.length}개 노트를 가져왔습니다.`);
      }
    });
  }
  async function exportNote(format: "md" | "html" | "pdf") {
    setExportOpen(false);
    if (!(await flush())) return;
    await action(async () => {
      if (await api.export({ id: active, format }))
        setNotice(`${format.toUpperCase()} 내보내기를 완료했습니다.`);
    });
  }
  async function remove() {
    if (!activeNote || !(await flush())) return;
    if (
      !confirm(
        "이 노트를 휴지통으로 이동할까요? 원본은 .xdocs/trash 폴더에 보관됩니다.",
      )
    )
      return;
    await action(async () => {
      await api.trash({ id: active, revision: current.current!.revision });
      const remaining = notes.filter((n) => n.id !== active);
      setWorkspace((w) => (w ? { ...w, notes: remaining } : w));
      select(remaining[0]);
    });
  }
  async function conflictCopy() {
    await action(async () => {
      const n = await api.create(
        (current.current?.title || "노트") + " 충돌 사본",
        draft.current,
      );
      update(n);
      select(n);
      setNotice("변경 내용을 별도 파일로 보존했습니다.");
    });
  }
  function changeBody(value: string) {
    draft.current = value;
    setBody(value);
    setStatus("pending");
  }
  function insert(prefix: string, suffix = "") {
    const el = textarea.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    const value =
      body.slice(0, start) +
      prefix +
      body.slice(start, end) +
      suffix +
      body.slice(end);
    changeBody(value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }
  const saveLabel =
    status === "saving"
      ? "저장 중…"
      : status === "pending"
        ? "저장 대기 중"
        : status === "error"
          ? "저장 실패"
          : isDesktop
            ? "로컬에 저장됨"
            : "브라우저에 저장됨";

  return (
    <div className={`app ${sidebar ? "" : "sidebar-hidden"}`}>
      <header className="titlebar">
        <div className="wordmark">
          xdocs<span>.</span>
        </div>
        <span className="titlebar-center">생각을 쓰고, 지식을 연결하다</span>
        <span className="version">
          LOCAL FIRST <span>α 0.1</span>
        </span>
      </header>
      <aside className="sidebar">
        <button
          className="workspace-switch"
          onClick={openVault}
          disabled={busy}
        >
          <span className="workspace-icon">
            <BookOpen size={19} />
          </span>
          <span>
            <strong>{workspace?.name || "나의 보관함"}</strong>
            <small>
              {isDesktop ? "Personal workspace" : "Browser preview"}
            </small>
          </span>
          <ChevronDown size={14} />
        </button>
        <button
          className="nav-item search-nav"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={16} />
          <span>빠른 검색</span>
          <kbd>⌘ K</kbd>
        </button>
        <button
          className={`nav-item ${view === "graph" ? "active" : ""}`}
          onClick={() => setView("graph")}
        >
          <Network size={16} />
          <span>지식 그래프</span>
        </button>
        <div className="nav-label">
          <span>개인 보관함</span>
          <button
            aria-label="새 노트"
            title="새 노트"
            onClick={createNote}
            disabled={!workspace || busy}
          >
            <Plus size={15} />
          </button>
        </div>
        <button className="nav-item folder" onClick={openVault} disabled={busy}>
          <FolderOpen size={16} />
          <span>모든 노트</span>
          <small>{notes.length}</small>
        </button>
        <div className="note-list">
          {notes.map((n) => (
            <button
              key={n.id}
              title={n.path}
              className={`nav-item note-item ${active === n.id && view === "note" ? "active" : ""}`}
              onClick={() => void navigate(n.id)}
            >
              <FileText size={15} />
              <span>{n.title}</span>
            </button>
          ))}
          {workspace && !notes.length && (
            <p className="sidebar-empty">첫 번째 노트를 작성해 보세요.</p>
          )}
        </div>
        <div className="nav-label">
          <span>함께하는 공간</span>
        </div>
        <button className="nav-item" onClick={() => setSettings(true)}>
          <Building2 size={16} />
          <span>조직 보관함</span>
          <small>예정</small>
        </button>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={16} />
            <span>환경 설정</span>
          </button>
          <div className="vault-state">
            <span className="status-dot" />
            {isDesktop
              ? workspace
                ? "로컬 보관함 연결됨"
                : "보관함을 선택하세요"
              : "브라우저 미리보기"}
            <button
              onClick={refresh}
              disabled={!workspace || busy}
              aria-label="보관함 새로고침"
            >
              <RefreshCw size={13} />
            </button>
          </div>
          <div className="vault-path" title={workspace?.root}>
            {workspace?.root || "내 파일에서 시작하기"}
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="toolbar">
          <div className="breadcrumb">
            <button
              className="icon-button"
              aria-label="사이드바 전환"
              onClick={() => setSidebar((s) => !s)}
            >
              <PanelLeftClose size={17} />
            </button>
            <span>개인 보관함</span>
            <ChevronRight size={12} />
            <strong>
              {view === "graph" ? "연결 탐색" : activeNote?.title || "시작하기"}
            </strong>
          </div>
          <div className="toolbar-actions">
            <span
              className={`save-state ${status === "error" ? "error-text" : ""}`}
            >
              {status === "saving" ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <Check size={13} />
              )}
              <span>{saveLabel}</span>
            </span>
            <div className="export-wrap">
              <button
                className="button small"
                disabled={!activeNote || busy}
                onClick={() => setExportOpen((s) => !s)}
              >
                내보내기
                <ArrowUpRight size={14} />
              </button>
              {exportOpen && (
                <div className="dropdown">
                  {(["md", "pdf", "html"] as const).map((f) => (
                    <button key={f} onClick={() => void exportNote(f)}>
                      <ArrowDownToLine size={14} />
                      {f === "md" ? "Markdown" : f.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {!isDesktop && (
          <div className="preview-banner">
            <Monitor size={13} />
            브라우저 미리보기 · 실제 파일 저장은 데스크톱 앱에서 지원합니다.
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            {status === "error" && (
              <button onClick={conflictCopy}>
                <Copy size={14} />
                충돌 사본 저장
              </button>
            )}
            <button aria-label="오류 닫기" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {workspace && (
          <div className="view-tabs">
            <button
              className={view === "note" ? "active" : ""}
              onClick={() => setView("note")}
            >
              <AlignLeft size={15} />
              노트
            </button>
            <button
              className={view === "graph" ? "active" : ""}
              onClick={() => setView("graph")}
            >
              <Network size={15} />
              연결 탐색<span>{outgoing.length + backlinks.length}</span>
            </button>
            <div className="view-tools">
              {view === "note" && activeNote && (
                <button
                  className="mode-switch"
                  onClick={() => setEdit((s) => !s)}
                >
                  {edit ? <Eye size={14} /> : <Pencil size={14} />}{" "}
                  {edit ? "읽기 모드" : "편집하기"}
                </button>
              )}
            </div>
          </div>
        )}
        {!workspace ? (
          <section className="welcome">
            <span className="welcome-symbol">
              <BookOpen size={38} />
            </span>
            <span className="eyebrow">YOUR NOTES. YOUR SPACE.</span>
            <h1>
              생각이 머무는
              <br />
              나만의 공간.
            </h1>
            <p>
              내 폴더에 기록하고, 노트를 연결하세요.
              <br />
              계정 없이, 인터넷 없이 시작할 수 있습니다.
            </p>
            <button
              className="button primary"
              onClick={openVault}
              disabled={busy}
            >
              <FolderOpen size={16} />
              보관함 폴더 열기
            </button>
            <small>기존 Markdown 폴더 또는 빈 폴더를 선택하세요.</small>
          </section>
        ) : view === "graph" ? (
          <Graph
            notes={notes}
            active={active}
            onOpen={(id) => void navigate(id)}
          />
        ) : !activeNote ? (
          <section className="welcome">
            <FileText size={35} />
            <h1>첫 생각을 기록해 보세요.</h1>
            <p>새 노트를 만들거나 Markdown 파일을 가져오세요.</p>
            <div className="row">
              <button className="button primary" onClick={createNote}>
                <Plus size={16} />새 노트
              </button>
              <button
                className="button"
                onClick={importNotes}
                disabled={!isDesktop}
              >
                <Upload size={16} />
                가져오기
              </button>
            </div>
          </section>
        ) : (
          <div className={`document-layout ${edit ? "editing" : ""}`}>
            <article className="document">
              <div className="document-kicker">
                <span className="eyebrow">IDEAS INTO KNOWLEDGE</span>
                <button
                  className="icon-button"
                  aria-label="노트 삭제"
                  title="휴지통으로 이동"
                  onClick={remove}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {edit ? (
                <>
                  <div className="editor-toolbar" aria-label="Markdown 서식">
                    <button
                      title="굵게"
                      aria-label="굵게"
                      onClick={() => insert("**", "**")}
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      title="소제목"
                      aria-label="소제목"
                      onClick={() => insert("\n## ")}
                    >
                      <Heading2 size={17} />
                    </button>
                    <button
                      title="할 일"
                      aria-label="할 일"
                      onClick={() => insert("\n- [ ] ")}
                    >
                      <ListTodo size={17} />
                    </button>
                    <button
                      title="노트 연결"
                      aria-label="노트 연결"
                      onClick={() => insert("[[", "]]")}
                    >
                      <Link2 size={16} />
                    </button>
                    <button
                      title="코드"
                      aria-label="코드"
                      onClick={() => insert("`", "`")}
                    >
                      <Code2 size={16} />
                    </button>
                    <span>Markdown</span>
                  </div>
                  <textarea
                    ref={textarea}
                    className="editor"
                    aria-label="노트 본문"
                    value={body}
                    spellCheck={false}
                    onChange={(e) => changeBody(e.target.value)}
                    onCompositionStart={() => {
                      composing.current = true;
                    }}
                    onCompositionEnd={() => {
                      composing.current = false;
                      void flush();
                    }}
                    placeholder="# 제목을 입력하세요"
                  />
                  <div className="editor-hint">
                    [[노트 제목]] 또는 [[노트 ID|표시 이름]]으로 연결 · Ctrl / ⌘
                    S 저장
                  </div>
                </>
              ) : (
                <Markdown
                  body={body}
                  notes={notes}
                  onOpen={(id) => void navigate(id)}
                />
              )}
              <div className="document-end">
                <span>—</span>
                <span>
                  {tags.map((t) => (
                    <span className="tag" key={t}>
                      #{t}
                    </span>
                  ))}
                </span>
                <span>{body.length.toLocaleString()}자</span>
              </div>
            </article>
            <aside className="context">
              <div className="context-heading">
                이 노트의 목차
                <List size={14} />
              </div>
              <div className="toc">
                {headings.length ? (
                  headings.map((h, i) => <span key={i}>{h}</span>)
                ) : (
                  <span>소제목을 추가하면 표시됩니다.</span>
                )}
              </div>
              <div className="context-heading">
                주변 연결<span>{outgoing.length + backlinks.length}</span>
              </div>
              <Graph
                compact
                notes={notes}
                active={active}
                onOpen={(id) => void navigate(id)}
              />
              <button className="text-button" onClick={() => setView("graph")}>
                그래프 펼쳐보기
                <ArrowUpRight size={13} />
              </button>
              <div className="context-heading backlink-heading">
                이 노트를 언급한 문서<span>{backlinks.length}</span>
              </div>
              {backlinks.length ? (
                backlinks.map((n) => (
                  <button
                    className="backlink"
                    key={n.id}
                    onClick={() => void navigate(n.id)}
                  >
                    <span>
                      <FileText size={13} />
                      {n.title}
                    </span>
                    <small>
                      {n.body
                        .split("\n")
                        .find((l) => l.includes("[["))
                        ?.replace(/\[\[|\]\]/g, "")}
                    </small>
                  </button>
                ))
              ) : (
                <p className="muted small-text">
                  다른 노트에서 이 노트를 연결하면 여기에 표시됩니다.
                </p>
              )}
              <div className="file-info">
                <HardDrive size={13} />
                <span title={activeNote.path}>{activeNote.path}</span>
              </div>
            </aside>
          </div>
        )}
      </main>
      <footer className="statusbar">
        <span>
          <HardDrive size={11} />
          {isDesktop ? "로컬 파일" : "미리보기"}
          <i />
          Markdown
        </span>
        <span>
          {notes.length}개 노트
          <i />
          {isDesktop ? "SQLite 색인" : "브라우저 저장소"}
          <i />
          오프라인 사용 가능
        </span>
        <button onClick={() => setSettings(true)}>
          {theme === "dark" ? <Moon size={12} /> : <Sun size={12} />}{" "}
          {
            (
              {
                light: "화이트",
                gray: "그레이",
                dark: "다크",
                system: "시스템",
              } as const
            )[theme]
          }
        </button>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {searchOpen && (
        <div className="overlay" onClick={() => setSearchOpen(false)}>
          <section
            className="dialog search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-field">
              <Search size={20} />
              <label
                className="sr-only"
                id="search-title"
                htmlFor="search-input"
              >
                빠른 검색
              </label>
              <input
                id="search-input"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="어떤 생각을 찾고 있나요?"
              />
              <button
                className="icon-button"
                aria-label="검색 닫기"
                onClick={() => setSearchOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="search-results">
              {results.map((n) => (
                <button key={n.id} onClick={() => void navigate(n.id)}>
                  <FileText size={18} />
                  <span>
                    <strong>{n.title}</strong>
                    <small>
                      {n.body.replace(/[#\[\]*]/g, "").slice(0, 95)}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {!results.length && <p>일치하는 노트가 없습니다.</p>}
            </div>
            <footer>
              제목과 본문에서 검색 <kbd>ESC 닫기</kbd>
            </footer>
          </section>
        </div>
      )}
      {settings && (
        <div className="overlay" onClick={() => setSettings(false)}>
          <section
            className="dialog settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">MAKE IT YOURS</span>
                <h2 id="settings-title">환경 설정</h2>
              </div>
              <button
                className="icon-button"
                aria-label="설정 닫기"
                onClick={() => setSettings(false)}
              >
                <X size={20} />
              </button>
            </header>
            <h3>화면 테마</h3>
            <p>글에 집중할 수 있는 나만의 밝기를 선택하세요.</p>
            <div className="theme-options">
              {(["light", "gray", "dark", "system"] as const).map((t) => (
                <button
                  aria-pressed={theme === t}
                  className={`theme-option ${theme === t ? "chosen" : ""}`}
                  key={t}
                  onClick={() => setTheme(t)}
                >
                  <span className={`theme-preview theme-${t}`}>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    {
                      (
                        {
                          light: "화이트",
                          gray: "그레이",
                          dark: "다크",
                          system: "시스템",
                        } as const
                      )[t]
                    }
                    {theme === t && <Check size={13} />}
                  </span>
                </button>
              ))}
            </div>
            <hr />
            <h3>내 보관함</h3>
            <p className="settings-path">
              {workspace?.root || "아직 연결된 폴더가 없습니다."}
            </p>
            <div className="row">
              <button
                className="button"
                onClick={() => {
                  setSettings(false);
                  void openVault();
                }}
              >
                <FolderOpen size={15} />
                폴더 변경
              </button>
              <button
                className="button"
                disabled={!workspace || !isDesktop}
                onClick={() => {
                  setSettings(false);
                  void importNotes();
                }}
              >
                <Upload size={15} />
                Markdown 가져오기
              </button>
            </div>
            <hr />
            <div className="planned">
              <Building2 size={19} />
              <div>
                <h3>조직 연결</h3>
                <p>PostgreSQL · Redis · SSO</p>
              </div>
              <span className="badge">후속 개발</span>
            </div>
            <p className="small-text">
              현재 버전은 개인 로컬 보관함을 지원합니다. 서버 연결 및 로그인
              정보는 수집하지 않습니다.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
