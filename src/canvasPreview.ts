import { boundarySVG } from "../shared/network-boundaries.mjs";
import { drawingSVG } from "../shared/aws-drawing.mjs";
import { decodeArchitecture } from "../shared/architecture.mjs";
import {
  decodeWorkflow,
  workflowNodes,
  templates,
} from "../shared/workflows.mjs";
import type { Note } from "./types";

export const isCanvas = (note: Note) =>
  note.canvas ?? /^```xdocs-(architecture|workflow)\r?$/m.test(note.body);
export const embedLine = /^!\[\[([^\]\n]+)\]\]$/;
export const escapeHTML = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function canvasPreview(note: Note, title: string) {
  let drawing = "",
    caption = "캔버스";
  if (!note.unloaded) {
    try {
      const arch = decodeArchitecture(note.body);
      if (arch) {
        drawing = arch.drawing ? drawingSVG(arch.drawing) : boundarySVG(arch);
        caption = arch.drawing
          ? "AWS 드로잉 · 서비스 " + arch.drawing.items.length
          : "xinfra · 컴포넌트 " + arch.nodes.length;
      } else {
        const flow = decodeWorkflow(note.body);
        if (flow) {
          const cards = workflowNodes(flow.kind, flow.source);
          caption =
            templates[flow.kind as keyof typeof templates].label +
            " · 카드 " +
            cards.length;
          const positions = new Map(
            cards.map((c, i) => {
              const saved = flow.positions[c.id];
              const x = Number.isFinite(saved?.x) ? saved.x : (i % 3) * 225;
              const y = Number.isFinite(saved?.y)
                ? saved.y
                : Math.floor(i / 3) * 110;
              return [c.id, { x, y }];
            }),
          );
          const width = Math.max(
            200,
            ...Array.from(positions.values(), (p) => p.x + 200),
          );
          const height = Math.max(
            90,
            ...Array.from(positions.values(), (p) => p.y + 90),
          );
          const lines = cards
            .flatMap((c) =>
              c.refs.map((id: string) => {
                const a = positions.get(c.id)!,
                  b = positions.get(id);
                return b
                  ? '<line x1="' +
                      (a.x + 90) +
                      '" y1="' +
                      (a.y + 35) +
                      '" x2="' +
                      (b.x + 90) +
                      '" y2="' +
                      (b.y + 35) +
                      '" stroke="currentColor"/>'
                  : "";
              }),
            )
            .join("");
          const boxes = cards
            .map((c) => {
              const p = positions.get(c.id)!;
              return (
                '<g transform="translate(' +
                p.x +
                " " +
                p.y +
                ')"><rect width="180" height="70" rx="8"/><text x="10" y="26">' +
                escapeHTML(c.type) +
                '</text><text x="10" y="52">' +
                escapeHTML(c.label.slice(0, 22)) +
                "</text></g>"
              );
            })
            .join("");
          drawing =
            '<svg class="flow-thumbnail" viewBox="-4 -4 ' +
            (width + 8) +
            " " +
            (height + 8) +
            '">' +
            lines +
            boxes +
            "</svg>";
        }
      }
    } catch {
      caption = "미리보기를 표시할 수 없습니다";
    }
  }
  return (
    '<a class="canvas-embed" href="#note-' +
    escapeHTML(note.id) +
    '"><span><strong>' +
    escapeHTML(title) +
    "</strong><small>" +
    escapeHTML(caption) +
    " · 원본 열기 ↗</small></span>" +
    drawing +
    "</a>"
  );
}
