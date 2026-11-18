import type { Note, NoteAPI, Workspace } from "./types";
import DOMPurify from "dompurify";
import { marked } from "marked";
const key = "xdocs.preview.v1";
export const isDesktop = Boolean(window.xdocs);
const seeds = [
  [
    "생각이 연결되는 공간",
    "# 생각이 연결되는 공간\n\n흩어진 메모가 하나의 지식이 되는 곳.\n더 편하게 쓰고, 더 자연스럽게 발견하기.\n\n## 좋은 도구는 생각을 방해하지 않는다\n\n떠오른 생각을 바로 기록하고, 나중에 다시 찾을 수 있어야 한다. 문서를 정리하는 시간보다 생각하는 시간이 더 많아지도록.\n\n우리가 만들고 싶은 경험은 [[UI 디자인 원칙]]과 [[로컬 우선 설계]]에서 시작한다.\n\n> 기록은 파일로 남고, 연결은 지식으로 자란다.\n\n## 첫 번째 버전에 담을 것\n\n- [x] 인터넷 없이도 자연스럽게 쓰기\n- [x] 내 노트를 내 폴더에 보관하기\n- [ ] 노트 사이의 연결을 한눈에 발견하기\n\n#제품기획 #xdocs",
  ],
  [
    "UI 디자인 원칙",
    "# UI 디자인 원칙\n\n읽기 쉬운 여백, 조용한 도구, 끊기지 않는 생각의 흐름.\n\n## 덜어낼수록 선명해지는 것\n\n- 색보다 여백으로 구조를 표현합니다.\n- 화이트, 그레이, 다크 모드를 제공합니다.\n- 키보드만으로도 노트를 오갈 수 있습니다.\n\n[[생각이 연결되는 공간]] #디자인",
  ],
  [
    "로컬 우선 설계",
    "# 로컬 우선 설계\n\n내 파일에서 시작하기. 네트워크가 없어도 기록은 언제나 내 곁에.\n\n## 저장 원칙\n\nMarkdown이 원본이고, SQLite는 다시 만들 수 있는 색인입니다.\n\n[[개인 지식 관리]] [[생각이 연결되는 공간]] #설계",
  ],
  [
    "개인 지식 관리",
    "# 개인 지식 관리\n\n기록하고, 연결하고, 다시 발견하기.\n\n[[주간 아이디어]]와 [[UI 디자인 원칙]]을 돌아봅니다. #생각",
  ],
  [
    "주간 아이디어",
    "# 주간 아이디어\n\n## 이번 주에 떠오른 생각\n\n- 글쓰기와 탐색을 하나의 공간에서.\n- [[생각이 연결되는 공간]]에 제품 방향 정리하기.\n\n#기록",
  ],
];
const read = (): Workspace => {
  const raw = localStorage.getItem(key);
  if (raw) {
    const workspace: Workspace = JSON.parse(raw);
    if (workspace.name === "나의 보관함") workspace.name = "워크스페이스";
    return workspace;
  }
  const notes = seeds.map(([title, body], i) => ({
    id: "demo-" + i,
    title,
    body,
    path: title + ".md",
    revision: "initial",
  }));
  return { root: "브라우저 미리보기", name: "워크스페이스", notes };
};
const write = (w: Workspace) => localStorage.setItem(key, JSON.stringify(w));
const preview: NoteAPI = {
  async load() {
    return read();
  },
  async open() {
    return read();
  },
  async refresh() {
    return read();
  },
  async create(title, body = "# " + title + "\n\n") {
    const w = read();
    const n = {
      id: crypto.randomUUID(),
      title,
      body,
      path: title + ".md",
      revision: crypto.randomUUID(),
    };
    w.notes.push(n);
    write(w);
    return n;
  },
  async save({ id, body, revision }) {
    const w = read();
    const old = w.notes.find((n) => n.id === id);
    if (!old || old.revision !== revision)
      throw new Error("다른 창에서 변경되었습니다. 충돌 사본을 저장해 주세요.");
    const note: Note = {
      ...old,
      body,
      title: body.match(/^#\s+(.+)$/m)?.[1] || old.title,
      revision: crypto.randomUUID(),
    };
    w.notes = w.notes.map((n) => (n.id === id ? note : n));
    write(w);
    return note;
  },
  async trash({ id, revision }) {
    const w = read();
    const n = w.notes.find((n) => n.id === id);
    if (!n || n.revision !== revision)
      throw new Error(
        "다른 창에서 변경되었습니다. 새로고침 후 다시 확인하세요.",
      );
    const trash = JSON.parse(localStorage.getItem(key + ".trash") || "[]");
    trash.push(n);
    localStorage.setItem(key + ".trash", JSON.stringify(trash));
    w.notes = w.notes.filter((n) => n.id !== id);
    write(w);
  },
  async search(q) {
    return read().notes.filter((n) =>
      (n.title + n.body).toLowerCase().includes(q.toLowerCase()),
    );
  },
  async export({ id, format }) {
    const n = read().notes.find((n) => n.id === id)!;
    if (format === "pdf") {
      window.print();
      return true;
    }
    const text =
      format === "md"
        ? n.body
        : '<!doctype html><meta charset="utf-8">' +
          DOMPurify.sanitize(marked.parse(n.body) as string);
    const url = URL.createObjectURL(
      new Blob([text], {
        type: format === "md" ? "text/markdown" : "text/html",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = n.title + "." + format;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  },
  async importMarkdown() {
    throw new Error("파일 가져오기는 데스크톱 앱에서 사용할 수 있습니다.");
  },
};
export const api = window.xdocs || preview;
