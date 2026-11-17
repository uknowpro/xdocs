import { architectureEdges } from "../shared/architecture.mjs";
import { useRef, useState } from "react";
import { boundarySVG, placementFields } from "../shared/network-boundaries.mjs";
import type {
  ArchitectureModel,
  ArchitectureNode,
} from "./ArchitectureDocument";
type Props = {
  fit: boolean;
  model: ArchitectureModel;
  selected: string;
  readonly: boolean;
  onSelect: (n: ArchitectureNode) => void;
  onPlace: (
    child: ArchitectureNode,
    field: string,
    parent: ArchitectureNode,
  ) => void;
};
export default function NetworkLayout({
  model,
  fit,
  selected,
  readonly,
  onSelect,
  onPlace,
}: Props) {
  const start = useRef<{ id: string; x: number; y: number } | null>(null),
    [notice, setNotice] = useState("");
  const [references, setReferences] = useState(false);
  const edges = references
    ? architectureEdges(model).filter(
        (e) => e.source === selected || e.target === selected,
      )
    : [];
  const find = (el: Element | null) =>
    model.nodes.find(
      (n) => n.id === el?.closest("[data-scope]")?.getAttribute("data-scope"),
    );
  return (
    <div className={fit ? "network-layout fit" : "network-layout"}>
      <label className="reference-toggle">
        <input
          type="checkbox"
          checked={references}
          onChange={(e) => setReferences(e.target.checked)}
        />{" "}
        선택 리소스 참조선
      </label>
      <div
        className="network-sheet"
        aria-label="클라우드 경계 도면"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            const n = find(e.target as Element);
            if (n) {
              e.preventDefault();
              onSelect(n);
            }
          }
        }}
        onPointerDown={(e) => {
          const n = find(e.target as Element);
          if (!n || e.button !== 0) return;
          start.current = { id: n.id, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          const child = model.nodes.find((n) => n.id === s.id);
          if (!child) return;
          if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) {
            onSelect(child);
            setNotice("");
            return;
          }
          if (readonly || child.imported) return;
          const parent = find(document.elementFromPoint(e.clientX, e.clientY));
          const rule =
            placementFields[child.kind as keyof typeof placementFields];
          if (!rule || !parent || parent.kind !== rule[1] || parent.imported) {
            setNotice("이 항목을 수용하는 상위 경계의 제목 위에 놓으세요.");
            return;
          }
          onPlace(child, rule[0], parent);
          setNotice(child.label + " → " + parent.label);
        }}
        dangerouslySetInnerHTML={{
          __html: boundarySVG(model, selected, edges),
        }}
      />
      {references && (
        <div className="reference-list" aria-label="선택 리소스 참조">
          {edges.length
            ? edges.map((e, i) => (
                <span key={i}>
                  {model.nodes.find((n) => n.id === e.source)?.label} →{" "}
                  {model.nodes.find((n) => n.id === e.target)?.label} ·{" "}
                  {e.field}
                </span>
              ))
            : "직접 참조가 없습니다."}
        </div>
      )}
      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
