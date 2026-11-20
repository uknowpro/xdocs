import { architectureEdges } from "../shared/architecture.mjs";
import { useRef, useState } from "react";
import {
  boundarySVG,
  boundaryLayout,
  containerKinds,
} from "../shared/network-boundaries.mjs";
import { canPlace } from "../shared/placement-edit.mjs";
import type {
  ArchitectureModel,
  ArchitectureNode,
} from "./ArchitectureDocument";
type View = NonNullable<ArchitectureModel["presentation"]>;
type Props = {
  focused?: {source:string;target:string};
  onReference: () => void;
  planLabels:Record<string,string>;
  focusRelated: boolean;
  fit: boolean;
  model: ArchitectureModel;
  selected: string;
  readonly: boolean;
  onSelect: (n: ArchitectureNode) => void;
  onView: (v: View) => void;
  onPlace: (child: ArchitectureNode, parent: ArchitectureNode) => void;
};
export default function NetworkLayout({
  model,
  focused, onReference,
  planLabels,
  focusRelated,
  fit,
  selected,
  readonly,
  onSelect,
  onPlace,
  onView,
}: Props) {
  const [notice, setNotice] = useState(""),
    [hover, setHover] = useState(""),
    [dragging, setDragging] = useState(""),
    [preview, setPreview] = useState<{
      key: string;
      x: number;
      y: number;
    } | null>(null);
  const [linkTarget, setLinkTarget] = useState(""),
    [linkLabel, setLinkLabel] = useState("");
  const start = useRef<{
    id: string;
    x: number;
    y: number;
    bend?: string;
  } | null>(null);
  const view = model.presentation || {},
    node = model.nodes.find((n) => n.id === selected);
  const updateView = onView;
  const refs = Boolean(focused) || focusRelated || (view.refs ?? false),
    all = refs ? architectureEdges(model) : [];
  const { representatives } = boundaryLayout({ ...model, presentation: view });
  const edges = all.filter(
    (e) =>
      (!focused || (e.source === focused.source && e.target === focused.target)) &&
      (representatives.get(e.source) === selected ||
        representatives.get(e.target) === selected) &&
      representatives.get(e.source) !== representatives.get(e.target),
  );
  const find = (el: Element | null) => {
    const target = el?.closest("[data-scope],[data-boundary]");
    return model.nodes.find(
      (n) =>
        n.id ===
        (target?.getAttribute("data-scope") ||
          target?.getAttribute("data-boundary")),
    );
  };
  function toggle(key: "folded" | "locked") {
    const ids = view[key] || [];
    updateView({
      ...view,
      [key]: ids.includes(selected)
        ? ids.filter((id) => id !== selected)
        : [...ids, selected],
    });
  }
  function end() {
    start.current = null;
    setHover("");
    setDragging("");
    setPreview(null);
  }
  function point(e: React.PointerEvent<HTMLDivElement>) {
    const svg = e.currentTarget.querySelector("svg")!,
      p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const pos = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.round(pos.x), y: Math.round(pos.y) };
  }
  const renderModel = preview
    ? {
        ...model,
        presentation: {
          ...view,
          routes: { ...view.routes, [preview.key]: preview },
        },
      }
    : { ...model, presentation: view };
  return (
    <div className={fit ? "network-layout fit" : "network-layout"}>
      <div className="network-actions">
        {(
          [
            ["resources", "리소스", true],
            ["refs", "선택 리소스 참조선", false],
            ["notes", "운영 주석", true],
            ["crossings", "선 교차 표시", true],
          ] as const
        ).map(([key, label, defaultValue]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={key === "refs" ? refs : view[key] ?? defaultValue}
              disabled={key === "refs" && (Boolean(focused) || focusRelated)}
              onChange={(e) => updateView({ ...view, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        {node && (
          <>
            {containerKinds.has(node.kind) && (
              <button onClick={() => toggle("folded")}>
                {view.folded?.includes(selected) ? "경계 펼치기" : "경계 접기"}
              </button>
            )}
            <button
              disabled={readonly}
              aria-pressed={view.locked?.includes(selected) || false}
              onClick={() => toggle("locked")}
            >
              {view.locked?.includes(selected) ? "배치 잠금 해제" : "배치 잠금"}
            </button>
          </>
        )}
      </div>
      <div
        className={focused ? "network-sheet reference-focused" : "network-sheet"}
        aria-label="클라우드 경계 도면"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            end();
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            const n = find(e.target as Element);
            if (n) {
              e.preventDefault();
              onSelect(n);
            }
          }
        }}
        onClick={e => {if (focused && (e.target as Element).closest("[data-reference]")) onReference();}}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const el = e.target as Element,
            bend = el.closest("[data-bend]")?.getAttribute("data-bend"),
            endpoint = el
              .closest("[data-reconnect]")
              ?.getAttribute("data-reconnect"),
            n = endpoint
              ? model.nodes.find((n) => n.id === endpoint)
              : find(el);
          if (!n && !bend) return;
          start.current = {
            id: n?.id || "",
            x: e.clientX,
            y: e.clientY,
            bend: bend || undefined,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (
            !s ||
            readonly ||
            Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5
          )
            return;
          if (s.bend) {
            setPreview({ key: s.bend, ...point(e) });
            return;
          }
          const child = model.nodes.find((n) => n.id === s.id),
            p = find(document.elementFromPoint(e.clientX, e.clientY));
          if (
            child &&
            !view.locked?.includes(child.id) &&
            (!child.imported || child.placementSource)
          ) {
            setDragging(child.id);
            setHover(canPlace(model, child, p) ? p!.id : "");
          }
        }}
        onPointerCancel={end}
        onPointerUp={(e) => {
          const s = start.current;
          end();
          if (!s) return;
          if (s.bend) {
            if (!readonly && Math.hypot(e.clientX - s.x, e.clientY - s.y) >= 5)
              updateView({
                ...view,
                routes: { ...view.routes, [s.bend]: point(e) },
              });
            return;
          }
          const child = model.nodes.find((n) => n.id === s.id);
          if (!child) return;
          if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) {
            onSelect(child);
            setNotice("");
            return;
          }
          if (readonly) return;
          const p = find(document.elementFromPoint(e.clientX, e.clientY));
          if (!p || !canPlace(model, child, p)) {
            setNotice("배치 잠금과 대상 경계의 유형을 확인하세요.");
            return;
          }
          onPlace(child, p);
          setNotice(child.label + " → " + p.label);
        }}
        dangerouslySetInnerHTML={{
          __html: boundarySVG(renderModel, selected, edges, hover, dragging, planLabels),
        }}
      />
      {hover && (
        <small role="status">
          이동 대상 · {model.nodes.find((n) => n.id === hover)?.label}
        </small>
      )}
      {refs && (
        <div className="reference-list" aria-label="선택 리소스 참조">
          {edges.length
            ? edges.map((e, i) => (
                <span key={i}>
                  {model.nodes.find((n) => n.id === e.source)?.label} →{" "}
                  {model.nodes.find((n) => n.id === e.target)?.label} ·{" "}
                  {e.label || e.field}
                  {(["source", "target"] as const).map((end) => {
                    const key = [e.source, e.field, e.target, end].join(":");
                    const label =
                      end === "source" ? "시작 연결점" : "끝 연결점";
                    return (
                      <label key={key}>
                        {label}{" "}
                        <select
                          aria-label={label}
                          disabled={readonly}
                          value={view.anchors?.[key] || "right"}
                          onChange={(event) =>
                            updateView({
                              ...view,
                              anchors: {
                                ...view.anchors,
                                [key]: event.target.value,
                              },
                            })
                          }
                        >
                          <option value="right">오른쪽</option>
                          <option value="left">왼쪽</option>
                          <option value="top">위</option>
                          <option value="bottom">아래</option>
                        </select>
                      </label>
                    );
                  })}
                </span>
              ))
            : "직접 참조가 없습니다."}
        </div>
      )}
      {node && view.notes !== false && (
        <details>
          <summary>설명선</summary>
          {(view.annotationLinks || [])
            .filter((l) => l.source === selected || l.target === selected)
            .map((l) => (
              <div key={l.source + ":" + l.target}>
                {model.nodes.find((n) => n.id === l.source)?.label} →{" "}
                {model.nodes.find((n) => n.id === l.target)?.label} · {l.label}
                {!readonly && (
                  <button
                    onClick={() =>
                      updateView({
                        ...view,
                        annotationLinks: view.annotationLinks?.filter(
                          (item) => item !== l,
                        ),
                      })
                    }
                  >
                    설명선 삭제
                  </button>
                )}
              </div>
            ))}
          {!readonly && (
            <>
              <label>
                설명선 대상
                <select
                  value={linkTarget}
                  onChange={(e) => setLinkTarget(e.target.value)}
                >
                  <option value="">대상 선택</option>
                  {model.nodes
                    .filter((n) => n.id !== selected)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                선 설명
                <input
                  value={linkLabel}
                  maxLength={100}
                  onChange={(e) => setLinkLabel(e.target.value)}
                />
              </label>
              <button
                disabled={
                  !linkTarget ||
                  selected === linkTarget ||
                  !model.nodes.some((n) => n.id === linkTarget) ||
                  !linkLabel.trim() ||
                  (view.annotationLinks || []).some(
                    (l) => l.source === selected && l.target === linkTarget,
                  )
                }
                onClick={() => {
                  updateView({
                    ...view,
                    annotationLinks: [
                      ...(view.annotationLinks || []),
                      {
                        source: selected,
                        target: linkTarget,
                        label: linkLabel.trim(),
                      },
                    ],
                  });
                  setLinkLabel("");
                  setLinkTarget("");
                }}
              >
                설명선 추가
              </button>
            </>
          )}
        </details>
      )}
      {node && view.notes !== false && (
        <label className="network-note">
          운영 주석{" "}
          <input
            readOnly={readonly}
            maxLength={160}
            value={view.annotations?.[selected] || ""}
            onChange={(e) =>
              updateView({
                ...view,
                annotations: {
                  ...view.annotations,
                  [selected]: e.target.value,
                },
              })
            }
          />
        </label>
      )}
      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
