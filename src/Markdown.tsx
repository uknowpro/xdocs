import { useMemo } from "react";
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
  const html = useMemo(() => {
    const renderer = new marked.Renderer();
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
  }, [body, notes]);
  return (
    <div
      className="markdown"
      onClick={(e) => {
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
