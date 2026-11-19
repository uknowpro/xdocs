import Xcode from "./Xcode";
import {decode as decodeXcode, fresh as freshXcode, pack as packXcode, replaceSession} from "./xcode-session";
import { LicensePage } from "./LicensePage";
import Analyzer from "./Analyzer";
import {readAnalyzerSettings,writeAnalyzerSettings,analyzerMarker} from "../shared/analyzer.mjs";
import Builder from "./Builder";
import {
  publishedHarness,
  newBuilder,
  encodeBuilder,
  decodeBuilder,
  replaceBuilder,
} from "../shared/builder.mjs";
import { version as appVersion } from "../package.json";
import PageTree, { type PageKind } from "./PageTree";
import {
  folderBody,
  isFolderPage,
  parentHeader,
  withParent,
} from "../shared/page-parent.mjs";
import { isCanvas } from "./canvasPreview";
import { WorkflowCanvas, blankFlow } from "./WorkflowCanvas";
import {
  templates,
  encodeWorkflow,
  decodeWorkflow,
  replaceWorkflow,
} from "../shared/workflows.mjs";
import ArchitectureDocument, {
  ArchitectureStart,
  type ArchitectureModel,
} from "./ArchitectureDocument";
import {
  decodeArchitecture,
  encodeArchitecture,
  replaceArchitecture,
} from "../shared/architecture.mjs";
import DocumentPermissions from "./DocumentPermissions";
import InfrastructureDocument, {
  InfrastructureStart,
  type InfrastructureSnapshot,
} from "./InfrastructureDocument";
import {
  decodeInfrastructure,
  encodeInfrastructure,
  replaceInfrastructure,
} from "../shared/infrastructure.mjs";
import SheetTable from "./SheetTable";
import {
  decodeWorkbook,
  encodeWorkbook,
  replaceWorkbook,
} from "../shared/tabular.mjs";
import OrganizationPanel from "./OrganizationPanel";

import VaultTools from "./VaultTools";
import Attachments from "./Attachments";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FileStack,
  Workflow,
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
  ChevronsLeft,
  ChevronsRight,
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
import type { Note, Workspace, UpdateState } from "./types";
import { linksIn, resolveLink } from "./model";
import Markdown from "./Markdown";
import Graph from "./Graph";

const BlockEditor = lazy(() => import("./BlockEditor"));
const CollaborationEditor = lazy(() => import("./CollaborationEditor"));
type Theme = "light" | "gray" | "dark" | "system";
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [active, setActive] = useState("");
  const [body, setBody] = useState("");
  const [view, setView] = useState<"note" | "graph">("note");
  const [edit, setEdit] = useState(false);
  const [editorMode, setEditorMode] = useState<"source" | "blocks">("source");
  const [architectureStart, setArchitectureStart] = useState(false);
  const [infrastructureStart, setInfrastructureStart] = useState(false);
  const [permissions, setPermissions] = useState(false);
  const [recovery, setRecovery] = useState<"history" | "trash" | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("xdocs.theme") as Theme) || "light",
  );
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [settings, setSettings] = useState<boolean | "license">(false);
  const returningFromLicense = useRef(false);
  const [organizationPanel, setOrganizationPanel] = useState(false);
  const [collaborating, setCollaborating] = useState(false);
  const collaborationNote = useRef<Note | null>(null);
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
  const [desktopSidebar, setDesktopSidebar] = useState(
    () => localStorage.getItem("xdocs.sidebar") !== "closed",
  );
  const [compactNav, setCompactNav] = useState(
    () => matchMedia("(max-width: 600px)").matches,
  );
  const [drawer, setDrawer] = useState(false);
  const sidebar = compactNav ? drawer : desktopSidebar;
  useEffect(() => {
    const query = matchMedia("(max-width: 600px)");
    const resize = () => {
      setCompactNav(query.matches);
      setDrawer(false);
    };
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  function toggleSidebar() {
    requestAnimationFrame(() =>
      sidebarToggle.current?.focus({ preventScroll: true }),
    );
    if (compactNav) setDrawer(!drawer);
    else {
      localStorage.setItem("xdocs.sidebar", desktopSidebar ? "closed" : "open");
      setDesktopSidebar(!desktopSidebar);
    }
  }
  const architectureName = useRef<string | undefined>(undefined);
  const architectureParent = useRef<string | undefined>(undefined);
  const current = useRef<Note | null>(null);
  const draft = useRef("");
  const saving = useRef<Promise<boolean> | null>(null);
  const closeGuard = useRef<(() => Promise<boolean>) | null>(null);
  const registerCloseGuard = useCallback(
    (guard: (() => Promise<boolean>) | null) => {
      closeGuard.current = guard;
    },
    [],
  );
  const composing = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [naming, setNaming] = useState<{
    parent?: string;
    existing?: Note;
    kind?: PageKind;
  } | null>(null);
  const [folderName, setFolderName] = useState("");
  useEffect(() => setNaming(null), [workspace?.root]);
  function nameFolder(parent?: string, existing?: Note) {
    setFolderName(existing?.title || "");
    setNaming({ parent, existing });
  }
  async function submitFolder() {
    const title = folderName.trim();
    if (!title || !naming || !(await flush())) return;
    const { parent, existing, kind } = naming;
    if (kind) {
      setNaming(null);
      setDrawer(false);
      await createPage(kind, parent, title);
      return;
    }
    await action(async () => {
      const full =
        existing?.unloaded && api.readNote
          ? await api.readNote(existing.id)
          : existing;
      const saved =
        existing && full
          ? await api.save({
              id: existing.id,
              revision: existing.revision,
              body: full.body.replace(/^# .+$/m, () => "# " + title),
            })
          : await api.create(title, folderBody(parent, title));
      update(saved);
      if (current.current?.id === saved.id) select(saved);
      setNaming(null);
    });
  }
  const [creatingNote, setCreatingNote] = useState(false);
  const selectionVersion = useRef(0);
  const draftVersion = useRef(0);
  const loadingRef = useRef(false);
  const shared = workspace?.kind === "server";
  const sheetData = useMemo(() => {
    try {
      return decodeWorkbook(body);
    } catch {
      return null;
    }
  }, [body]);
  const xcode = useMemo(() => decodeXcode(body), [body]);
  const analyzer = /^<!-- xdocs:analyzer -->$/m.test(body);
  const builder = useMemo(() => decodeBuilder(body), [body]);
  const flow = useMemo(() => {
    try {
      return decodeWorkflow(body);
    } catch {
      return null;
    }
  }, [body]);
  const architectureData = useMemo(() => {
    try {
      return decodeArchitecture(body) as ArchitectureModel | null;
    } catch {
      return null;
    }
  }, [body]);
  const infraData = useMemo(() => {
    try {
      return decodeInfrastructure(body) as InfrastructureSnapshot | null;
    } catch {
      return null;
    }
  }, [body]);
  const readonly =
    loadingNote ||
    creatingNote ||
    workspace?.role === "reader" ||
    workspace?.notes.find((n) => n.id === active)?.role === "reader";
  const activeNote = workspace?.notes.find((n) => n.id === active);
  const notes = useMemo(() => workspace?.notes || [], [workspace]);
  const canvases = useMemo(() => notes.filter(isCanvas), [notes]);
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
          (n.links || linksIn(n.body)).some(
            (t) => resolveLink(t, notes)?.id === active,
          ),
      ),
    [notes, active],
  );
  const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1]);
  const tags = [
    ...new Set([...body.matchAll(/(?:^|\s)#([^\s#]+)/g)].map((m) => m[1])),
  ].slice(0, 4);

  function select(note: Note | undefined) {
    const ticket = ++selectionVersion.current;
    if (note?.unloaded && api.readNote) {
      const same = note.id === current.current?.id;
      if (same && note.revision === current.current?.revision) return;
      const draftAtRequest = draftVersion.current;
      if (!same) {
        loadingRef.current = true;
        setLoadingNote(true);
        setActive(note.id);
        current.current = null;
        draft.current = "";
        setBody("");
      }
      void api
        .readNote(note.id)
        .then((full) => {
          if (ticket !== selectionVersion.current) return;
          if (same && draftAtRequest !== draftVersion.current) {
            setNotice("외부 변경을 감지했습니다. 편집 중인 내용은 유지합니다.");
            return;
          }
          select(full);
        })
        .catch((e) => {
          if (ticket === selectionVersion.current) {
            setError(String(e));
            loadingRef.current = false;
            setLoadingNote(false);
          }
        });
      return;
    }
    loadingRef.current = false;
    setLoadingNote(false);
    current.current = note || null;
    draft.current = note?.body || "";
    setActive(note?.id || "");
    setBody((note?.body || "").replace(parentHeader, ""));
    setStatus("saved");
    setError("");
  }
  const update = useCallback((full: Note) => {
    const note = isDesktop
      ? {
          ...full,
          sheet: /^```xdocs-sheets\r?$/m.test(full.body),
          canvas: Boolean(isCanvas(full)),
          body: JSON.parse(JSON.stringify(full.body.slice(0, 240))),
          links: linksIn(full.body),
          tags: [...full.body.matchAll(/(?:^|\s)#([^\s#]+)/g)].map((m) => m[1]),
          unloaded: true,
        }
      : full;
    return setWorkspace((w) =>
      w
        ? {
            ...w,
            notes: w.notes.some((n) => n.id === note.id)
              ? w.notes.map((n) => (n.id === note.id ? note : n))
              : [...w.notes, note],
          }
        : w,
    );
  }, []);
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
    api
      .updateStatus?.()
      .then(setUpdateState)
      .catch(() => {});
    return api.onUpdate?.(setUpdateState);
  }, []);
  useEffect(
    () =>
      api.onChanged?.((w) => {
        setWorkspace(w);
        if (saving.current || loadingRef.current) return;
        const existing = current.current;
        const incoming = w.notes.find((n) => n.id === existing?.id);
        if (existing && incoming?.revision === existing.revision) return;
        if (existing && draft.current !== existing.body) {
          setNotice("외부 변경을 감지했습니다. 편집 중인 내용은 유지합니다.");
          return;
        }
        select(incoming || w.notes[0]);
      }),
    [],
  );
  useEffect(() => api.onWatchError?.((message) => setError(message)), []);
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
        void (async () => {
          if (closeGuard.current && !(await closeGuard.current())) return false;
          return flush();
        })().then((ok) => {
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
        setDrawer(false);
        setSearchOpen(false);
        setSettings(false);
        setRecovery(null);
        setOrganizationPanel(false);
        setExportOpen(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [flush]);
  useEffect(() => {
    if (
      !searchOpen &&
      !settings &&
      !organizationPanel &&
      !recovery &&
      !collaborating
    )
      return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      const dialog = document.querySelector<HTMLElement>(".dialog");
      const selector = returningFromLicense.current
        ? "#license-button"
        : settings === "license" ? "#license-title" : "input,button";
      returningFromLicense.current = false;
      dialog?.querySelector<HTMLElement>(selector)?.focus();
    }, 0);
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const elements = [
        ...document.querySelectorAll<HTMLElement>(
          ".dialog button:not(:disabled), .dialog input, .dialog summary",
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
  }, [searchOpen, settings, organizationPanel, recovery, collaborating]);
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
  async function createNote(parent?: string, title = "새 노트") {
    if (readonly) return;
    setCreatingNote(true);
    try {
      if (!(await flush())) return;
      await action(async () => {
        const n = await api.create(
          title,
          parent ? withParent(parent, "# " + title + "\n\n") : undefined,
        );
        update(n);
        select(n);
        setView("note");
        setEdit(true);
      });
    } finally {
      setCreatingNote(false);
    }
  }
  async function placePage(id: string, expected: string, next: string) {
    if (!(await flush())) return false;
    const w = await api.refresh();
    const summary = w.notes.find((n) => n.id === id);
    if (!summary || w.role === "reader" || summary.role === "reader")
      throw Error("이 페이지를 이동할 수 없습니다.");
    const full =
      summary.unloaded && api.readNote ? await api.readNote(id) : summary;
    if ((full.body.match(parentHeader)?.[0] || "") !== expected)
      throw Error(
        "다른 편집에서 페이지 위치가 변경되었습니다. 보관함을 새로고침하세요.",
      );
    const target = next.match(parentHeader)?.[1];
    if (target && target !== "@") {
      const parents = new Map(
        w.notes.map((n) => [n.id, n.body.match(parentHeader)?.[1]]),
      );
      if (!parents.has(target)) throw Error("대상 페이지를 찾을 수 없습니다.");
      const seen = new Set([id]);
      for (
        let p: string | undefined = target;
        p && parents.has(p);
        p = parents.get(p)
      ) {
        if (seen.has(p))
          throw Error("자기 자신이나 하위 페이지로 이동할 수 없습니다.");
        seen.add(p);
      }
    }
    const saved = await api.save({
      id,
      revision: full.revision,
      body: next + full.body.replace(parentHeader, ""),
    });
    if (current.current?.id === id) {
      if (draft.current === current.current.body) select(saved);
      else {
        current.current = saved;
        draft.current = next + draft.current.replace(parentHeader, "");
      }
    }
    update(saved);
    return true;
  }
  async function createPage(kind: PageKind, parent?: string, name?: string) {
    if (kind === "folder") return nameFolder(parent);
    if (kind === "sheet") return createSheets(parent, name);
    if (kind === "note") return createNote(parent, name);
    if (!(await flush())) return;
    if (kind === "architecture") {
      architectureParent.current = parent;
      architectureName.current = name;
      setArchitectureStart(true);
      return;
    }
    await action(async () => {
      const title =
        name ||
        (kind === "xcode" ? "새 xcode 세션" : kind === "analyzer" ? "새 Analyzer" : kind === "builder" ? "새 Builder" : templates[kind].label + " 캔버스");
      const n = await api.create(
        title,
        withParent(
          parent,
          "# " +
            title +
            "\n\n" +
            (kind === "xcode" ? packXcode(freshXcode()) : kind === "analyzer" ? analyzerMarker : kind === "builder"
              ? encodeBuilder(newBuilder())
              : encodeWorkflow(blankFlow(kind))) +
            "\n",
        ),
      );
      setWorkspace(await api.refresh());
      select(n);
      setView("note");
      setEdit(false);
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
  async function attach() {
    await action(async () => {
      const a = await api.addAttachment?.();
      if (a)
        changeBody(
          draft.current +
            "\n\n" +
            (a.kind === "image" ? "!" : "") +
            "[" +
            a.name.replace(/[\[\]]/g, "") +
            "](" +
            a.path +
            ")\n",
        );
    });
  }
  async function openRecovery(mode: "history" | "trash") {
    if (await flush()) setRecovery(mode);
  }
  async function createSheets(parent?: string, title = "새 시트") {
    if (!(await flush())) return;
    await action(async () => {
      const n = await api.create(
        title,
        withParent(
          parent,
          "# " +
            title +
            "\n\n" +
            encodeWorkbook({
              version: 1,
              sheets: [
                {
                  id: crypto.randomUUID(),
                  name: "시트 1",
                  rows: [["", "", "", ""]],
                },
              ],
            }) +
            "\n",
        ),
      );
      setWorkspace(await api.refresh());
      select(n);
      setView("note");
      setEdit(false);
    });
  }
  async function importSheets(directory = false) {
    if (!(await flush())) return;
    await action(async () => {
      const result = directory
        ? await api.importSheetDirectory?.()
        : await api.importSpreadsheet?.();
      if (result) {
        setWorkspace(await api.refresh());
        if (result.note) {
          select(result.note);
          setView("note");
          setEdit(false);
        }
        setNotice(result.warnings.join(" ") || "시트를 가져왔습니다.");
      }
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
    if (readonly) return;
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
    draftVersion.current++;
    const header = current.current?.body.match(parentHeader)?.[0] || "";
    const content = value.replace(parentHeader, "");
    draft.current = header + content;
    setBody(content);
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
            ? shared
              ? "이 기기에 저장됨"
              : "로컬에 저장됨"
            : "브라우저에 저장됨";

  return (
    <div className={`app ${sidebar ? "" : "sidebar-hidden"}`}>
      <header className="titlebar">
        <div className="wordmark">
          xdocs<span>.</span>
        </div>
        <span className="titlebar-center">생각을 쓰고, 지식을 연결하다</span>
        <span className="version">
          LOCAL FIRST <span>v{appVersion}</span>
        </span>
      </header>
      {!sidebar && (
        <div className="sidebar-rail">
          <button
            className="sidebar-switch"
            aria-label="왼쪽 메뉴 펼치기"
            title="왼쪽 메뉴 펼치기"
            aria-controls="workspace-navigation"
            aria-expanded={false}
            ref={sidebarToggle}
            onClick={toggleSidebar}
          >
            <ChevronsRight size={19} />
          </button>
        </div>
      )}
      {compactNav && drawer && (
        <button
          className="nav-backdrop"
          aria-label="왼쪽 메뉴 닫기"
          tabIndex={-1}
          onClick={() => setDrawer(false)}
        />
      )}
      <aside
        className="sidebar"
        id="workspace-navigation"
        inert={!sidebar}
        onClick={(e) => {
          if (
            compactNav &&
            (e.target as Element).closest(
              "button.nav-item:not(.note-item), .workspace-switch",
            )
          )
            setDrawer(false);
        }}
      >
        <div className="sidebar-heading">
          <button
            className="workspace-switch"
            onClick={openVault}
            disabled={busy}
          >
            <span className="workspace-icon">
              <BookOpen size={19} />
            </span>
            <span>
              <strong>{workspace?.name || "워크스페이스"}</strong>
              <small>
                {isDesktop ? "Personal workspace" : "Browser preview"}
              </small>
            </span>
            <ChevronDown size={14} />
          </button>
          {sidebar && (
            <button
              className="sidebar-switch"
              aria-label="왼쪽 메뉴 접기"
              title="왼쪽 메뉴 접기"
              aria-controls="workspace-navigation"
              aria-expanded
              ref={sidebarToggle}
              onClick={toggleSidebar}
            >
              <ChevronsLeft size={19} />
            </button>
          )}
        </div>
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
          <span>{shared ? "조직 보관함" : "개인 보관함"}</span>
          <button
            aria-label="새 노트"
            title="새 노트"
            onClick={() => {
              setDrawer(false);
              void createNote();
            }}
            disabled={!workspace || busy}
          >
            <Plus size={15} />
          </button>
        </div>
        <button
          className="nav-item"
          disabled={!workspace || workspace.role === "reader" || busy}
          onClick={() => nameFolder()}
        >
          <FolderOpen size={16} />새 폴더
        </button>
        {naming && (
          <form
            className="folder-name-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submitFolder();
            }}
          >
            <label>
              {naming.existing
                ? "폴더 이름 변경"
                : naming.kind
                  ? "페이지 이름"
                  : "폴더 이름"}
              <input
                autoFocus
                required
                maxLength={100}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </label>
            <button disabled={busy || !folderName.trim()}>저장</button>
            <button type="button" onClick={() => setNaming(null)}>
              취소
            </button>
          </form>
        )}
        <PageTree
          onRename={(note) => nameFolder(undefined, note)}
          onMove={placePage}
          key={workspace?.root}
          notes={notes}
          active={view === "note" ? active : ""}
          readonly={busy || workspace?.role === "reader"}
          onOpen={(id) => {
            setDrawer(false);
            void navigate(id);
          }}
          onCreate={(parent, kind) => {
            const target = notes.find((n) => n.id === parent);
            if (kind !== "folder" && target && isFolderPage(target)) {
              setFolderName("");
              setNaming({ parent, kind });
              return;
            }
            if (kind !== "folder") setDrawer(false);
            void createPage(kind, parent);
          }}
        />
        <div className="nav-label">
          <span>문서 만들기</span>
        </div>
        <button
          className="nav-item"
          disabled={!workspace || readonly || busy}
          onClick={() => void createSheets()}
        >
          <Plus size={16} />새 시트 테이블
        </button>
        <button
          className="nav-item"
          disabled={!workspace || readonly || busy}
          onClick={async () => {
            if (await flush()) setInfrastructureStart(true);
          }}
        >
          <FileStack size={16} />
          인프라 문서
        </button>
        <button
          className="nav-item"
          disabled={!workspace || readonly || busy}
          onClick={async () => {
            await createPage("architecture");
          }}
        >
          <Workflow size={16} />
          IaCD 아키텍처
        </button>
        <button className="nav-item" disabled={!workspace || readonly || busy} onClick={() => void createPage("xcode")}>
          <Code2 size={16} />xcode 세션 만들기
        </button>
        <button className="nav-item" disabled={!workspace || readonly || busy} onClick={() => void createPage("analyzer")}>
          <Network size={16} />Analyzer 만들기
        </button>
        <button
          className="nav-item"
          disabled={!workspace || readonly || busy}
          onClick={() => void createPage("builder")}
        >
          <Workflow size={16} />
          Builder 만들기
        </button>
        <select
          className="nav-item"
          aria-label="자동화 캔버스 만들기"
          value=""
          disabled={!workspace || readonly || busy}
          onChange={(e) => {
            const k = e.target.value as keyof typeof templates;
            if (k) {
              setDrawer(false);
              void createPage(k);
            }
          }}
        >
          <option value="">새 자동화·스택 캔버스</option>
          {Object.entries(templates).map(([k, t]) => (
            <option key={k} value={k}>
              {t.label}
            </option>
          ))}
        </select>
        {api.importSheetDirectory && (
          <button
            className="nav-item"
            disabled={!workspace || readonly || busy}
            onClick={() => void importSheets(true)}
          >
            <FolderOpen size={16} />
            Excel 폴더 가져오기
          </button>
        )}
        {api.importSpreadsheet && (
          <button
            className="nav-item"
            disabled={!workspace || readonly || busy}
            onClick={() => void importSheets()}
          >
            <Upload size={16} />
            Excel · 시트 가져오기
          </button>
        )}
        <div className="nav-label">
          <span>함께하는 공간</span>
        </div>
        <button
          className="nav-item"
          onClick={async () => {
            if (await flush()) setOrganizationPanel(true);
          }}
        >
          <Building2 size={16} />
          <span>조직 보관함</span>
          <small>SSO</small>
        </button>
        <div className="sidebar-bottom">
          {api.listTrash && !shared && (
            <button
              className="nav-item"
              onClick={() => void openRecovery("trash")}
            >
              <Trash2 size={16} />
              <span>휴지통</span>
            </button>
          )}
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={16} />
            <span>환경 설정</span>
          </button>
          <div className="vault-state">
            <span className="status-dot" />
            {isDesktop
              ? workspace
                ? shared
                  ? "조직 보관함 연결됨"
                  : "로컬 보관함 연결됨"
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
          {isDesktop && (
            <div className="vault-path" title={workspace?.root}>
              {workspace?.root || "내 파일에서 시작하기"}
            </div>
          )}
        </div>
      </aside>
      <main className="main" inert={compactNav && drawer}>
        <div className="toolbar">
          <div className="breadcrumb">
            <span>{shared ? "조직 보관함" : "개인 보관함"}</span>
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
              {flow || architectureData ? (
                <Workflow size={15} />
              ) : (
                <AlignLeft size={15} />
              )}
              {flow || architectureData ? "캔버스" : "노트"}
            </button>
            <button
              className={view === "graph" ? "active" : ""}
              onClick={() => setView("graph")}
            >
              <Network size={15} />
              연결 탐색<span>{outgoing.length + backlinks.length}</span>
            </button>
            <div className="view-tools">
              {view === "note" &&
                activeNote &&
                !readonly &&
                !sheetData &&
                !infraData &&
                !architectureData &&
                !xcode && !analyzer && !builder &&
                !flow && (
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
              <button
                className="button primary"
                onClick={() => void createNote()}
              >
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
          <div
            className={`document-layout ${edit ? "editing" : ""} ${sheetData || infraData || architectureData || xcode || analyzer || builder || flow ? "sheet-layout" : ""}`}
          >
            <article className="document">
              <div className="document-kicker">
                <span className="eyebrow">
                  {flow || architectureData ? "캔버스" : ""}
                </span>
                <button
                  className="icon-button"
                  aria-label="노트 삭제"
                  title="휴지통으로 이동"
                  onClick={remove}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {activeNote && (
                <div className="note-utilities">
                  {!edit &&
                    !readonly &&
                    !sheetData &&
                    !infraData &&
                    !architectureData &&
                    !xcode && !analyzer && !builder &&
                    !flow &&
                    canvases.length > 0 && (
                      <select
                        className="button small"
                        aria-label="캔버스 미리보기 삽입"
                        value=""
                        onChange={(e) => {
                          const n = canvases.find(
                            (n) => n.id === e.target.value,
                          );
                          if (n)
                            changeBody(
                              draft.current.trimEnd() +
                                "\n\n![[" +
                                n.id +
                                "]]\n",
                            );
                        }}
                      >
                        <option value="">캔버스 미리보기 삽입</option>
                        {canvases.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title}
                          </option>
                        ))}
                      </select>
                    )}
                  {shared &&
                    !readonly &&
                    !sheetData &&
                    !infraData &&
                    !architectureData &&
                    !xcode && !analyzer && !builder &&
                    !flow && (
                      <button
                        className="button small"
                        onClick={async () => {
                          if (await flush()) {
                            collaborationNote.current = current.current;
                            setCollaborating(true);
                          }
                        }}
                      >
                        공동 편집
                      </button>
                    )}
                  {edit &&
                    !sheetData &&
                    !infraData &&
                    !architectureData &&
                    !xcode && !analyzer && !builder &&
                    !flow && (
                      <div className="segmented">
                        <button
                          className={editorMode === "source" ? "selected" : ""}
                          onClick={() => setEditorMode("source")}
                        >
                          Markdown 원문
                        </button>
                        <button
                          className={editorMode === "blocks" ? "selected" : ""}
                          disabled={/^---\s*$|<\/?[a-zA-Z]|!\[|^\[\^/m.test(
                            body,
                          )}
                          title="HTML·첨부 이미지·프런트매터 등 확장 문법은 원문 모드를 사용하세요"
                          onClick={() => setEditorMode("blocks")}
                        >
                          블록 편집
                        </button>
                      </div>
                    )}
                  {api.addAttachment && !readonly && (
                    <button
                      className="text-button"
                      onClick={() => void attach()}
                    >
                      <Upload size={14} />
                      첨부
                    </button>
                  )}
                  {shared && workspace?.role === "owner" && (
                    <button
                      className="text-button"
                      onClick={() => setPermissions(true)}
                    >
                      문서 권한
                    </button>
                  )}
                  {api.history && (
                    <button
                      className="text-button"
                      onClick={() => void openRecovery("history")}
                    >
                      변경 이력
                    </button>
                  )}
                </div>
              )}
              {loadingNote || creatingNote ? (
                <p className="muted">노트 불러오는 중…</p>
              ) : xcode ? (
                <Xcode key={active} session={xcode} readonly={readonly} change={next => changeBody(replaceSession(draft.current,next))} />
              ) : analyzer ? (
                <Analyzer key={active} readonly={readonly} settings={readAnalyzerSettings(body)} onSettings={settings=>changeBody(writeAnalyzerSettings(draft.current,settings))} onSave={async(title, content)=>{
                  if(readonly || !(await flush())) return;
                  const n=await api.create(title,withParent(active,content));
                  update(n);select(n);setEdit(false);
                }}/>
              ) : builder ? (
                <Builder
                  key={active}
                  config={builder}
                  notes={notes}
                  readonly={readonly}
                  onChange={(c) => changeBody(replaceBuilder(draft.current, c))}
                  onCopy={async (name, c, publish = false) => {
                    if (readonly || !(await flush())) return;
                    const n = await api.create(
                      name,
                      withParent(
                        active,
                        (publish ? publishedHarness + "\n" : "") +
                          "# " +
                          name +
                          "\n\n" +
                          encodeBuilder({
                            ...c,
                            origin: {
                              page: active,
                              revision: current.current!.revision,
                            },
                          }) +
                          "\n",
                      ),
                    );
                    update(n);
                    select(n);
                    setEdit(false);
                  }}
                  onSave={async (content) => {
                    if (readonly || !(await flush())) return;
                    const n = await api.create(
                      "업무 검토 결과",
                      withParent(active, content),
                    );
                    update(n);
                    select(n);
                    setEdit(false);
                  }}
                />
              ) : flow ? (
                <WorkflowCanvas
                  key={active}
                  model={flow}
                  readonly={readonly}
                  onChange={(v) =>
                    changeBody(replaceWorkflow(draft.current, v))
                  }
                />
              ) : architectureData ? (
                <ArchitectureDocument
                  key={active}
                  model={architectureData}
                  readonly={readonly}
                  onChange={(m) =>
                    changeBody(replaceArchitecture(draft.current, m))
                  }
                />
              ) : infraData ? (
                <InfrastructureDocument
                  key={active}
                  snapshot={infraData}
                  readonly={readonly}
                  onChange={(value) =>
                    changeBody(replaceInfrastructure(draft.current, value))
                  }
                  onCreateNote={async (title, content) => {
                    if (!(await flush())) return;
                    const origin = current.current?.id;
                    const n = await api.create(
                      title,
                      content +
                        (origin ? "\n\n[[" + origin + "|인프라 문서]]\n" : ""),
                    );
                    setWorkspace(await api.refresh());
                    select(n);
                    setEdit(false);
                  }}
                />
              ) : sheetData ? (
                <SheetTable
                  key={active}
                  workbook={sheetData}
                  readonly={readonly}
                  onChange={(book) =>
                    changeBody(replaceWorkbook(draft.current, book))
                  }
                  onNote={(title, content) => {
                    void (async () => {
                      if (!(await flush())) return;
                      await action(async () => {
                        const n = await api.create(title, content);
                        setWorkspace(await api.refresh());
                        select(n);
                        setEdit(false);
                      });
                    })();
                  }}
                />
              ) : edit && !readonly && editorMode === "blocks" ? (
                <Suspense
                  fallback={<p className="muted">편집기 불러오는 중…</p>}
                >
                  <BlockEditor
                    key={active}
                    value={body}
                    onChange={changeBody}
                    notes={notes}
                    onComposition={(v) => {
                      composing.current = v;
                      if (!v) void flush();
                    }}
                  />
                </Suspense>
              ) : edit && !readonly ? (
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
              <Attachments body={body} />
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
          {isDesktop ? (shared ? "조직 캐시" : "로컬 파일") : "미리보기"}
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
      {collaborating && collaborationNote.current && (
        <Suspense
          fallback={<div className="overlay">공동 편집기 불러오는 중…</div>}
        >
          <CollaborationEditor
            registerGuard={registerCloseGuard}
            note={collaborationNote.current}
            onClose={() => {
              setCollaborating(false);
              void refresh();
            }}
            onCopy={(n) => {
              update(n);
              select(n);
              setCollaborating(false);
            }}
          />
        </Suspense>
      )}
      {organizationPanel && (
        <OrganizationPanel
          onClose={() => setOrganizationPanel(false)}
          onOpen={(w) => {
            setWorkspace(w);
            select(w?.notes[0]);
            setOrganizationPanel(false);
            setView("note");
            setEdit(false);
          }}
        />
      )}
      {architectureStart && (
        <ArchitectureStart
          onClose={() => setArchitectureStart(false)}
          onCreate={async (source) => {
            const model = architectureName.current
              ? { ...source, title: architectureName.current }
              : source;
            if (!(await flush())) return;
            const n = await api.create(
              model.title,
              withParent(
                architectureParent.current,
                "# " + model.title + "\n\n" + encodeArchitecture(model) + "\n",
              ),
            );
            setWorkspace(await api.refresh());
            select(n);
            setView("note");
            setEdit(false);
            setArchitectureStart(false);
          }}
        />
      )}
      {infrastructureStart && (
        <InfrastructureStart
          onClose={() => setInfrastructureStart(false)}
          onCreate={async (snapshot) => {
            if (!(await flush())) return;
            const title =
              "인프라 · " +
              snapshot.source.slice(0, 160).replace(/[\r\n]/g, " ");
            const n = await api.create(
              title,
              "# " + title + "\n\n" + encodeInfrastructure(snapshot) + "\n",
            );
            setWorkspace(await api.refresh());
            select(n);
            setView("note");
            setEdit(false);
            setInfrastructureStart(false);
          }}
        />
      )}
      {permissions && activeNote && (
        <DocumentPermissions
          id={active}
          onClose={() => setPermissions(false)}
        />
      )}
      {recovery && (
        <VaultTools
          mode={recovery}
          readonly={readonly}
          note={current.current || undefined}
          onClose={() => setRecovery(null)}
          onRestored={(n) => {
            update(n);
            select(n);
            setRecovery(null);
            setView("note");
            setNotice("노트를 복원했습니다.");
          }}
        />
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
                onChange={(e) => {
                  setResults([]);
                  setQuery(e.target.value);
                }}
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
      {settings === "license" && (
        <LicensePage
          close={() => setSettings(false)}
          back={() => {
            returningFromLicense.current = true;
            setSettings(true);
          }}
        />
      )}
      {settings === true && (
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
                disabled={!workspace || !isDesktop || shared}
                onClick={() => {
                  setSettings(false);
                  void importNotes();
                }}
              >
                <Upload size={15} />
                Markdown / HTML 가져오기
              </button>
            </div>
            <hr />
            <div className="license-setting">
              <h3>앱 정보</h3>
              <button
                id="license-button"
                className="button"
                onClick={() => setSettings("license")}
              >
                라이선스 정보
              </button>
            </div>
            {updateState && (
              <>
                <h3>앱 업데이트 · {updateState.version}</h3>
                <p>{updateState.message}</p>
                <div
                  className="row"
                  style={{ marginTop: 10, marginBottom: 20 }}
                >
                  <button
                    className="button"
                    disabled={
                      busy ||
                      ["checking", "downloading"].includes(updateState.status)
                    }
                    onClick={() =>
                      void action(async () =>
                        setUpdateState(await api.checkUpdate!()),
                      )
                    }
                  >
                    업데이트 확인
                  </button>
                  {updateState.status === "available" && (
                    <button
                      className="button"
                      onClick={() =>
                        void action(async () =>
                          setUpdateState(await api.downloadUpdate!()),
                        )
                      }
                    >
                      다운로드
                    </button>
                  )}
                  {updateState.status === "ready" && (
                    <button
                      className="button"
                      onClick={async () => {
                        if (await flush())
                          await action(async () => api.installUpdate!());
                      }}
                    >
                      저장하고 다시 시작
                    </button>
                  )}
                </div>
                <hr />
              </>
            )}
            <div className="planned">
              <Building2 size={19} />
              <div>
                <h3>조직 연결</h3>
                <p>PostgreSQL · Redis · OIDC SSO</p>
              </div>
              <button
                className="button"
                onClick={async () => {
                  if (await flush()) {
                    setSettings(false);
                    setOrganizationPanel(true);
                  }
                }}
              >
                연결 관리
              </button>
            </div>
            <p className="small-text">
              개인 보관함은 업로드되지 않습니다. 조직 문서는 별도 캐시와 변경
              대기열에 저장됩니다.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
