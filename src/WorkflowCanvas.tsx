import { useEditorPosition } from "./useEditorPosition";
import {createTwoFilesPatch} from "diff";
import CanvasSearch from "./CanvasSearch";
import { api } from "./api";
import { useRef, useState, useMemo, useLayoutEffect } from "react";
import { templates, workflowNodes, addBlock, jobDependencyIssues } from "../shared/workflows.mjs";
type Kind = keyof typeof templates;
export type Flow = {
  version: number;
  kind: Kind;
  source: string;
  positions: Record<string, { x: number; y: number }>;
};
export function blankFlow(kind: Kind): Flow {
  return { version: 1, kind, source: templates[kind].source, positions: {} };
}
export function WorkflowCanvas({
  model,
  onChange,
  readonly,
}: {
  model: Flow;
  onChange: (v: Flow) => void;
  readonly: boolean;
}) {
  const [selected, setSelected] = useState(""),
    [full, setFull] = useState(false),
    [draft, setDraft] = useState<string | null>(null),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => {
    try {
      return { nodes: workflowNodes(model.kind, model.source), error: "" };
    } catch (e) {
      return { nodes: [], error: String(e) };
    }
  }, [model.kind, model.source]);
  const nodes = parsed.nodes,
    active = nodes.find((n) => n.id === selected),
    source = model.source;
  const dependencyIssues=useMemo(()=>model.kind==="actions" ? jobDependencyIssues(nodes) : [],[model.kind,nodes]);
  const coords: Flow["positions"] = Object.fromEntries(
    nodes.map((n, i) => [
      n.id,
      model.positions[n.id] || {
        x: 20 + (i % 3) * 225,
        y: 24 + Math.floor(i / 3) * 110,
      },
    ]),
  );
  const baseline=useRef(model.source);
  const [showDiff,setShowDiff]=useState(false);
  const sourceKey=full || !nodes.length ? "file" : active?.id || "";
  const editor = useEditorPosition(sourceKey);
  const focusAfterSwitch=useRef(false);
  useLayoutEffect(()=>{
    if (focusAfterSwitch.current) {
      focusAfterSwitch.current=false;
      editor.current?.focus();
    }
  },[sourceKey,editor]);
  function prepareSwitch(nextKey:string) {
    if(nextKey===sourceKey) editor.current?.focus();
    else focusAfterSwitch.current=true;
  }
  function showBlock(id: string) {
    prepareSwitch(id);
    setSelected(id);
    setFull(false);
  }
  function commit(next: string) {
    if (readonly) return;
    try {
      workflowNodes(model.kind, next);
      onChange({ ...model, source: next });
      setError("");
      setDraft(null);
    } catch (e) {
      setError(String(e));
    }
  }
  async function download() {
    if (api.exportWorkflow) {
      try {
        await api.exportWorkflow(model.kind, source);
      } catch (e) {
        setError(String(e));
      }
      return;
    }
    const a = document.createElement("a"),
      url = URL.createObjectURL(new Blob([source]));
    a.href = url;
    a.download = templates[model.kind].name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section data-search-scope>
      <h1>{templates[model.kind].label} 캔버스</h1>
      <div className="canvas-findbar">
        <CanvasSearch
          label="블록 찾기"
          disabled={draft !== null}
          entries={nodes.map((n) => ({
            id: n.id,
            label: n.label,
            detail: n.type + " · " + n.id,
          }))}
          onChoose={showBlock}
        />
      </div>
      <div className="infra-actions">
        <button
          className="button"
          disabled={readonly || draft !== null}
          onClick={() => input.current?.click()}
        >
          원본 가져오기
        </button>
        <input
          ref={input}
          type="file"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              if (f.size > 500000)
                throw Error("500 KB 이하 파일을 선택하세요.");
              const src = new TextDecoder("utf-8", {
                fatal: true,
                ignoreBOM: true,
              }).decode(await f.arrayBuffer());
              workflowNodes(model.kind, src);
              if (
                window.confirm(
                  "현재 캔버스를 선택한 파일로 교체합니다. 원본 내용은 이 노트에 저장되며 조직 보관함에서는 동기화됩니다.",
                )
              ) {
                onChange({ ...model, source: src, positions: {} });
                setSelected("");
                setDraft(null);
                setError("");
              }
            } catch (e) {
              setError(String(e));
            } finally {
              if (input.current) input.current.value = "";
            }
          }}
        />
        <button
          className="button"
          disabled={readonly || draft !== null}
          onClick={() => {
            try {
              commit(addBlock(model.kind, source));
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          블록 추가
        </button>
        <button
          className="button"
          disabled={draft !== null}
          onClick={() => {prepareSwitch("file");setFull(true);}}
        >
          전체 원문
        </button>
        <button className="button" disabled={draft !== null} onClick={download}>
          파일 내보내기
        </button>
      </div>
      <details open={showDiff} onToggle={e=>setShowDiff(e.currentTarget.open)}><summary>열 때의 원본과 비교</summary>
        {showDiff && (baseline.current===source ? <p>저장된 변경이 없습니다.</p> :
          <pre className="review-diff">{createTwoFilesPatch(templates[model.kind].name,templates[model.kind].name,baseline.current,source)}</pre>)}
      </details>
      {dependencyIssues.length>0 && <section aria-label="작업 의존성 검사"><strong>작업 의존성 확인</strong><ul>{dependencyIssues.map(issue=><li key={issue}>{issue}</li>)}</ul></section>}
      {(error || parsed.error) && <p role="alert">{error || parsed.error}</p>}
      <div
        style={{
          overflow: "auto",
          maxHeight: 450,
          margin: "16px 0",
          border: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            position: "relative",
            background: "var(--surface)",
            width: Math.max(
              700,
              ...Object.values(coords).map((p) => p.x + 220),
            ),
            height: Math.max(
              215,
              ...Object.values(coords).map((p) => p.y + 100),
            ),
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (readonly) return;
            const id = e.dataTransfer.getData("x-xdocs-node");
            if (!Object.hasOwn(coords, id)) return;
            const rect = e.currentTarget.getBoundingClientRect();
            onChange({
              ...model,
              positions: {
                ...model.positions,
                [id]: {
                  x: Math.max(0, e.clientX - rect.left - 90),
                  y: Math.max(0, e.clientY - rect.top - 30),
                },
              },
            });
          }}
        >
          <svg
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {nodes.flatMap((n) =>
              n.refs.map(
                (id: string) =>
                  coords[id] && (
                    <line
                      key={n.id + id}
                      x1={coords[n.id].x + 90}
                      y1={coords[n.id].y + 35}
                      x2={coords[id].x + 90}
                      y2={coords[id].y + 35}
                      stroke="var(--muted)"
                    />
                  ),
              ),
            )}
          </svg>
          {nodes.map((n) => (
            <button
              key={n.id}
              draggable={!readonly}
              disabled={draft !== null}
              onDragStart={(e) => e.dataTransfer.setData("x-xdocs-node", n.id)}
              className={"arch-node " + (selected === n.id ? "selected" : "")}
              style={{ left: coords[n.id].x, top: coords[n.id].y }}
              onClick={() => showBlock(n.id)}
            >
              <span>
                <small>{n.type}</small>
                <strong>{n.label}</strong>
              </span>
            </button>
          ))}
        </div>
      </div>
      {(full || active || !nodes.length) && (
        <div>
          <label className="workflow-source">
            {full || !active ? "전체 원문" : active.label + " 블록"}
            <textarea
              key={sourceKey} ref={editor}
              aria-label="캔버스 코드"
              style={{
                width: "100%",
                minHeight: 210,
                fontFamily: "monospace",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
              readOnly={readonly}
              value={
                draft ??
                (full || !active
                  ? source
                  : source.slice(active.start, active.end))
              }
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          {draft !== null && (
            <div className="infra-actions">
              <button
                className="button"
                onClick={() =>
                  commit(
                    full || !active
                      ? draft
                      : source.slice(0, active.start) +
                          draft +
                          source.slice(active.end),
                  )
                }
              >
                수정 적용
              </button>
              <button className="button" onClick={() => setDraft(null)}>
                취소
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
