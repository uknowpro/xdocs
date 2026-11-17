import { selectedTableTSV } from "./tableClipboard";
import { toTSV } from "../shared/tabular.mjs";
import { api } from "./api";
import {
  canvasPreview,
  embedLine,
  isCanvas,
  escapeHTML,
} from "./canvasPreview";
import { useMemo, useState, useEffect } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Note } from "./types";
import { resolveLink } from "./model";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export default function Markdown({
  body,
  notes,
  onOpen,
}: {
  body: string;
  notes: Note[];
  onOpen: (id: string) => void;
}) {
  const [loaded, setLoaded] = useState<Note[]>([]);
  useEffect(() => {
    let alive = true;
    const targets = new Set<Note>();
    for (const token of marked.lexer(body)) {
      if (token.type !== "paragraph") continue;
      const match = embedLine.exec(token.raw.trim());
      const n = match && resolveLink(match[1].split("|")[0].trim(), notes);
      if (n && n.unloaded && isCanvas(n)) targets.add(n);
    }
    if (targets.size && api.readNote)
      void Promise.all(
        [...targets].map((n) => api.readNote!(n.id).catch(() => null)),
      ).then((result) => {
        if (alive) setLoaded(result.filter((n): n is Note => !!n));
      });
    return () => {
      alive = false;
    };
  }, [body, notes]);
  const html = useMemo(() => {
    const renderer = new marked.Renderer();
    const paragraph = renderer.paragraph.bind(renderer);
    renderer.paragraph = (token) => {
      const match = embedLine.exec(token.raw.trim());
      if (!match) return paragraph(token);
      const [target, label] = match[1].split("|");
      const n = resolveLink(target.trim(), notes);
      if (!n || !isCanvas(n))
        return (
          '<p class="muted">캔버스를 찾을 수 없습니다 · ' +
          escapeHTML(label || target) +
          "</p>"
        );
      return canvasPreview(
        (n.unloaded &&
          loaded.find((v) => v.id === n.id && v.revision === n.revision)) ||
          n,
        label || n.title,
      );
    };
    const originalTable = renderer.table.bind(renderer);
    renderer.table = (token) =>
      `<button class="text-button" data-copy-table="true">표 복사 (탭 구분)</button>${originalTable(token)}`;
    renderer.checkbox = ({ checked }) =>
      `<span class="task-mark" role="img" aria-label="${checked ? "완료" : "미완료"}">${checked ? "☑" : "☐"}</span>`;
    renderer.text = ({ text }) =>
      text.replace(/\[\[([^\]\n]+)\]\]/g, (_match, value: string) => {
        const [target, label] = value.split("|");
        const note = resolveLink(target.trim(), notes);
        return note
          ? `<a href="#note-${escape(note.id)}" class="wiki">${escape(label || note.title)}</a>`
          : `<span class="wiki unresolved" title="연결할 노트를 찾을 수 없습니다">${escape(label || target)}</span>`;
      });
    return DOMPurify.sanitize(
      marked.parse(body, { renderer, breaks: true }) as string,
      {
        FORBID_TAGS: [
          "img",
          "iframe",
          "object",
          "style",
          "script",
          "form",
          "input",
        ],
      },
    );
  }, [body, notes, loaded]);
  return (
    <div
      className="markdown"
      onCopy={(e) => {
        const text = selectedTableTSV(e.currentTarget);
        if (text !== null) {
          e.preventDefault();
          e.clipboardData.setData("text/plain", text);
        }
      }}
      onClick={(e) => {
        const copy = (e.target as HTMLElement).closest("[data-copy-table]");
        if (copy) {
          const table = copy.nextElementSibling as HTMLTableElement;
          const text = toTSV(
            Array.from(table.rows).map((row) =>
              Array.from(row.cells).map((cell) => cell.innerText),
            ),
          );
          void navigator.clipboard
            .writeText(text)
            .then(() => {
              copy.textContent = "복사됨";
            })
            .catch(() => {
              copy.textContent = "표를 선택한 후 Ctrl/⌘ C로 복사해 주세요";
            });
          return;
        }
        const a = (e.target as HTMLElement).closest("a");
        if (!a) return;
        e.preventDefault();
        const href = a.getAttribute("href");
        if (href?.startsWith("#note-")) onOpen(href.slice(6));
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
