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
  const [filter, setFilter] = useState("");
  const [limit, setLimit] = useState(60);
  const [scope, setScope] = useState<"local" | "all">("local");
  const [depth,setDepth]=useState(1);
  const [selected, setSelected] = useState(active);
  const allEdges = useMemo(() => edgesFor(notes), [notes]);
  const ids=new Set([active]);
  for(let hop=0;hop<(compact?1:depth);hop++){
    const prior=new Set(ids);
    for(const edge of allEdges) if(prior.has(edge.source)||prior.has(edge.target)){
      ids.add(edge.source);ids.add(edge.target);
    }
  }
  const candidates = (
    scope === "all" && !compact ? notes : notes.filter((n) => ids.has(n.id))
  ).filter(
    (n) =>
      compact ||
      !filter ||
      (n.title + " " + n.path + " " + n.body + " " + (n.tags || []).join(" "))
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
  const visible = [...candidates]
    .sort((a, b) => (a.id === active ? -1 : b.id === active ? 1 : 0))
    .slice(0, compact ? 9 : limit);
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
          <h1>지식 그래프</h1>
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
      {!compact && (
        <div className="graph-filters">
          <input
            aria-label="그래프 필터"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="제목·폴더·태그로 필터"
          />
          <span>{candidates.length}개 중 {visible.length}개</span>
          {scope==="local" && <label>연결 범위<select value={depth} onChange={e=>setDepth(Number(e.target.value))}>
            <option value={1}>직접 연결</option><option value={2}>두 단계 연결</option></select></label>}
          <label>
            표시 개수{" "}
            <select
              aria-label="그래프 표시 개수"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
            </select>
          </label>

        </div>
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
              {visible.length < candidates.length
                ? " · 필터로 범위를 좁혀 보세요"
                : ""}
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
