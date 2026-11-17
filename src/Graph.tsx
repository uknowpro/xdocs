import { useMemo, useState } from "react";
import { ArrowUpRight, Focus, Network } from "lucide-react";
import type { Note } from "./types";
import { edgesFor } from "./model";
export default function Graph({
  notes,
  active,
  onOpen,
  compact = false,
}: {
  notes: Note[];
  active: string;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  const [scope, setScope] = useState<"local" | "all">("local");
  const [selected, setSelected] = useState(active);
  const allEdges = useMemo(() => edgesFor(notes), [notes]);
  const ids = new Set([
    active,
    ...allEdges
      .filter((e) => e.source === active || e.target === active)
      .flatMap((e) => [e.source, e.target]),
  ]);
  const visible = (
    scope === "all" && !compact ? notes : notes.filter((n) => ids.has(n.id))
  ).slice(0, compact ? 9 : 60);
  const ordered = [...visible].sort((a, b) =>
    a.id === active ? -1 : b.id === active ? 1 : a.title.localeCompare(b.title),
  );
  const positions = ordered.map((n, i) => {
    const angle =
      ((i - 1) / Math.max(1, ordered.length - 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = i === 0 ? 0 : ordered.length > 12 && i % 2 === 0 ? 24 : 38;
    return {
      ...n,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    };
  });
  const edges = allEdges.filter(
    (e) =>
      positions.some((n) => n.id === e.source) &&
      positions.some((n) => n.id === e.target),
  );
  const choice =
    notes.find((n) => n.id === selected) || notes.find((n) => n.id === active);
  return (
    <div className={compact ? "graph compact" : "graph"}>
      {!compact && (
        <header className="graph-header">
          <div>
            <span className="eyebrow">CONNECTED THINKING</span>
            <h1>생각의 연결을 따라가 보세요</h1>
            <p>노트를 선택해 연결된 맥락을 발견하세요.</p>
          </div>
          <div className="segmented">
            <button
              className={scope === "local" ? "selected" : ""}
              onClick={() => setScope("local")}
            >
              <Focus size={14} />
              현재 노트
            </button>
            <button
              className={scope === "all" ? "selected" : ""}
              onClick={() => setScope("all")}
            >
              <Network size={14} />
              전체
            </button>
          </div>
        </header>
      )}
      <div className="graph-canvas" aria-label="노트 연결 그래프">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g>
            {edges.map((e, i) => {
              const a = positions.find((n) => n.id === e.source)!;
              const b = positions.find((n) => n.id === e.target)!;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={
                    e.source === selected || e.target === selected
                      ? "highlight"
                      : ""
                  }
                />
              );
            })}
          </g>
        </svg>
        {positions.map((n) => (
          <button
            title={n.title}
            aria-label={n.title}
            key={n.id}
            className={`graph-node ${n.id === (compact ? active : selected) ? "chosen" : ""}`}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            onClick={() => (compact ? onOpen(n.id) : setSelected(n.id))}
            onDoubleClick={() => onOpen(n.id)}
          >
            <span className="node-dot" />
            {!compact && <span>{n.title}</span>}
          </button>
        ))}
        {notes.length === 0 && (
          <p className="graph-empty">
            노트를 작성하고 [[노트 제목]]으로 연결해 보세요.
          </p>
        )}
      </div>
      {!compact && (
        <footer className="graph-footer">
          <div>
            <strong>{choice?.title || "노트가 없습니다"}</strong>
            <p>
              {visible.length}개 노트 · {edges.length}개 연결
              {visible.length === 60 ? " · 최대 60개 표시" : ""}
            </p>
          </div>
          {choice && (
            <button className="button" onClick={() => onOpen(choice.id)}>
              노트 열기
              <ArrowUpRight size={15} />
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
