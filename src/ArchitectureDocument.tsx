import IacDiff from "./IacDiff";
import NetworkLayout from "./NetworkLayout";
import { AwsDrawing, type Drawing } from "./AwsDrawing";
import { backupDrawing, blankDrawing } from "../shared/aws-drawing.mjs";
import { useRef, useState } from "react";
import {
  Box,
  Cloud,
  Container,
  Database,
  Network,
  Plus,
  Upload,
  Download,
  Undo2,
  Redo2,
  Trash2,
  Link2,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Code2,
  ShieldCheck,
  X,
  Copy,
} from "lucide-react";
import {
  COMPONENTS,
  AVM_MODULES,
  newArchitecture,
  newComponent,
  architectureExample,
  architectureEdges,
  architectureIssues,
  generateArchitecture,
  removeComponent,
  architectureReview,
  layoutArchitecture,
  architectureConnection,
} from "../shared/architecture.mjs";
import { zipSync, strToU8 } from "fflate";
import { api } from "./api";
export type ArchitectureNode = {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  props: Record<string, string>;
  imported?: boolean;
  address?: string;
  original?: Record<string, string>;
  references?: string[];
};
export type ArchitectureModel = {
  version: number;
  title: string;
  settings: Record<string, string>;
  nodes: ArchitectureNode[];
  sources: { name: string; content: string }[];
  warnings: string[];
  drawing?: Drawing;
  review?: Record<string, string>;
};
const icon = (kind: string) =>
  kind.includes("storage") || kind.includes("bucket") || kind.includes("pvc")
    ? Database
    : kind.includes("network") ||
        kind.includes("vpc") ||
        kind.includes("subnet") ||
        kind.includes("service")
      ? Network
      : kind.startsWith("k8s_")
        ? Container
        : Cloud;
export function ArchitectureStart({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (m: ArchitectureModel) => Promise<void>;
}) {
  const [preview, setPreview] = useState<ArchitectureModel | null>(null),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(m: ArchitectureModel) {
    setBusy(true);
    try {
      await onCreate(m);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay">
      <section
        className="dialog architecture-start"
        role="dialog"
        aria-label="IaCD 아키텍처 만들기"
      >
        <header>
          <h2>IaCD · 아키텍처 설계</h2>
          <button aria-label="아키텍처 만들기 닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <p>구성 요소를 배치하고 연결해 코드와 문서를 함께 만드세요.</p>
        <div className="arch-start-options">
          <button
            className="button"
            disabled={busy}
            onClick={() => void create(newArchitecture())}
          >
            <Plus size={16} />빈 캔버스
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => void create(architectureExample())}
          >
            <LayoutGrid size={16} />
            멀티클라우드 예제
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void create({
                ...newArchitecture(),
                title: "AWS · 계정 간 백업",
                drawing: backupDrawing() as Drawing,
              })
            }
          >
            <Cloud size={16} />
            AWS 백업 드로잉 예제
          </button>
          <button
            className="button"
            disabled={busy || !api.importArchitecture}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const m = await api.importArchitecture!();
                if (m) {
                  setPreview(m);
                  setAccepted(false);
                }
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Upload size={16} />
            Terraform 가져오기
          </button>
        </div>
        <p className="muted small-text">
          AWS · Azure · Azure Verified Modules · GCP · Kubernetes. .tf와
          .tf.json 파일 선택은 데스크톱 앱에서 지원합니다.
        </p>
        {preview && (
          <section className="infra-preview">
            <h3>
              {preview.nodes.length}개 컴포넌트 · {preview.sources.length}개
              원본 파일
            </h3>
            <p>{preview.sources.map((f) => f.name).join(", ")}</p>
            <p>
              원본 설정·변수 기본값·주석도 노트에 보관합니다. 비밀정보를 먼저
              제거하세요. 조직 보관함에서는 원본도 동기화됩니다.
            </p>
            <label>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              원본 설정을 이 노트에 보관하는 것을 확인했습니다.
            </label>
            <p>
              <button
                className="button primary"
                disabled={!accepted || busy}
                onClick={() => void create(preview)}
              >
                다이어그램으로 가져오기
              </button>
            </p>
          </section>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
export default function ArchitectureDocument({
  model,
  onChange,
  readonly = false,
}: {
  model: ArchitectureModel;
  onChange: (m: ArchitectureModel) => void;
  readonly?: boolean;
}) {
  const [selected, setSelected] = useState(model.nodes[0]?.id || ""),
    [group, setGroup] = useState("전체"),
    [zoom, setZoom] = useState(1),
    [boundary, setBoundary] = useState(true),
    [fitBoundary, setFitBoundary] = useState(true),
    [tab, setTab] = useState(model.drawing ? "drawing" : "canvas"),
    [format, setFormat] = useState("all"),
    [only, setOnly] = useState(false),
    [file, setFile] = useState(""),
    [connecting, setConnecting] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [baseline, setBaseline] = useState(model),
    [comparison, setComparison] = useState(false),
    [customBase, setCustomBase] = useState(false);
  const undo = useRef<ArchitectureModel[]>([]),
    redo = useRef<ArchitectureModel[]>([]),
    [, rerender] = useState(0),
    viewport = useRef<HTMLDivElement>(null);
  const node = model.nodes.find((n) => n.id === selected),
    edges = architectureEdges(model),
    issues = architectureIssues(model);
  let result: {
    files: Record<string, string>;
    errors: string[];
    warnings: string[];
  };
  try {
    result = generateArchitecture(model, format, only && node ? [node.id] : []);
  } catch (e) {
    result = { files: {}, errors: [String(e)], warnings: [] };
  }
  const fileNames = Object.keys(result.files),
    activeFile = fileNames.includes(file) ? file : fileNames[0];
  function change(next: ArchitectureModel) {
    if (readonly) return;
    try {
      undo.current.push(model);
      if (undo.current.length > 60) undo.current.shift();
      redo.current = [];
      onChange(next);
      setError("");
    } catch (e) {
      undo.current.pop();
      setError(String(e));
    }
  }
  function updateNode(patch: Partial<ArchitectureNode>) {
    if (node)
      change({
        ...model,
        nodes: model.nodes.map((n) =>
          n.id === node.id ? { ...n, ...patch } : n,
        ),
      });
  }
  function add(kind: string, x?: number, y?: number) {
    if (readonly) return;
    const n = newComponent(
      kind,
      x ?? 60 + (model.nodes.length % 4) * 220,
      y ?? 60 + Math.floor(model.nodes.length / 4) * 130,
    ) as ArchitectureNode;
    change({ ...model, nodes: [...model.nodes, n] });
    setSelected(n.id);
  }
  function select(n: ArchitectureNode) {
    if (connecting && node) {
      const match = Object.entries(COMPONENTS[node.kind]?.fields || {}).find(
        ([, f]: [string, any]) => f.ref === n.kind,
      );
      if (!match || node.imported) {
        setError(
          "이 두 컴포넌트에는 지원하는 연결이 없습니다. 속성의 연결 대상을 확인하세요.",
        );
        return;
      }
      updateNode({ props: { ...node.props, [match[0]]: n.id } });
      setConnecting(false);
    } else setSelected(n.id);
  }
  async function download() {
    try {
      if (result.errors.length) throw Error(result.errors[0]);
      if (api.exportArchitecture) {
        const saved = await api.exportArchitecture(
          model,
          format,
          only && node ? [node.id] : [],
        );
        if (!saved) return;
      } else {
        const zip = zipSync(
          Object.fromEntries(
            Object.entries(result.files).map(([p, c]) => [p, strToU8(c)]),
          ),
        );
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(zip)], { type: "application/zip" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "xdocs-architecture.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setStatus("코드 묶음을 내보냈습니다.");
    } catch (e) {
      setError(String(e));
    }
  }
  const width = Math.max(1000, ...model.nodes.map((n) => n.x + 240)),
    height = Math.max(650, ...model.nodes.map((n) => n.y + 150));
  return (
    <section
      className="architecture-document"
      aria-label="IaCD 아키텍처 편집기"
    >
      <div className="arch-header">
        <div>
          <span className="eyebrow">
            INFRASTRUCTURE AS CODE & DOCUMENTATION
          </span>
          <input
            aria-label="아키텍처 제목"
            value={model.title}
            readOnly={readonly}
            onChange={(e) => change({ ...model, title: e.target.value })}
          />
        </div>
        <span className="arch-count">
          {tab === "drawing"
            ? (model.drawing?.accounts.length ?? 0) +
              "개 계정 영역 · " +
              (model.drawing?.items.length ?? 0) +
              "개 서비스"
            : model.nodes.length + "개 컴포넌트 · " + edges.length + "개 연결"}
        </span>
      </div>
      <div className="arch-toolbar">
        <div className="segmented">
          {[
            ["canvas", "설계"],
            ["drawing", "AWS 드로잉"],
            ["code", "코드 추출"],
            ["review", "WAF 검토"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              onClick={() => setTab(id)}
            >
              {id === "canvas" ? (
                <LayoutGrid size={14} />
              ) : id === "code" ? (
                <Code2 size={14} />
              ) : (
                <ShieldCheck size={14} />
              )}{" "}
              {label}
            </button>
          ))}
        </div>
        <div className="arch-tools">
          <button
            title="실행 취소"
            aria-label="아키텍처 실행 취소"
            disabled={readonly || !undo.current.length}
            onClick={() => {
              const prev = undo.current.pop();
              if (prev) {
                redo.current.push(model);
                onChange(prev);
                rerender((v) => v + 1);
              }
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            title="다시 실행"
            aria-label="아키텍처 다시 실행"
            disabled={readonly || !redo.current.length}
            onClick={() => {
              const next = redo.current.pop();
              if (next) {
                undo.current.push(model);
                onChange(next);
                rerender((v) => v + 1);
              }
            }}
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {tab === "drawing" && (
        <AwsDrawing
          data={model.drawing || blankDrawing()}
          readonly={readonly}
          onChange={(drawing) => change({ ...model, drawing })}
        />
      )}
      {tab === "canvas" && (
        <div className="arch-editor">
          <aside className="arch-palette">
            <strong>컴포넌트</strong>
            <select
              aria-label="컴포넌트 공급자"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {[
                "전체",
                ...new Set(Object.values(COMPONENTS).map((c: any) => c.group)),
              ].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            {Object.entries(COMPONENTS)
              .filter(([, c]) => group === "전체" || c.group === group)
              .map(([kind, c]) => {
                const Icon = icon(kind);
                return (
                  <button
                    key={kind}
                    draggable={!readonly}
                    disabled={readonly}
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "application/x-xdocs-component",
                        kind,
                      )
                    }
                    onClick={() => add(kind)}
                    title={c.group + " · " + c.label}
                  >
                    <Icon size={17} />
                    <span>
                      {c.label}
                      <small>{c.group}</small>
                    </span>
                    <Plus size={12} />
                  </button>
                );
              })}
          </aside>
          <div className="arch-workspace">
            <div className="arch-canvas-tools">
              <div className="segmented">
                <button
                  aria-pressed={boundary}
                  className={boundary ? "selected" : ""}
                  onClick={() => setBoundary(true)}
                >
                  경계 도면
                </button>
                <button
                  aria-pressed={!boundary}
                  className={!boundary ? "selected" : ""}
                  onClick={() => setBoundary(false)}
                >
                  자유 배치·참조선
                </button>
              </div>
              {boundary && (
                <button onClick={() => setFitBoundary(!fitBoundary)}>
                  {fitBoundary ? "확대 보기" : "전체 맞춤"}
                </button>
              )}
            </div>
            {boundary && model.nodes.length > 0 ? (
              <>
                <p className="boundary-hint">
                  {connecting
                    ? "연결할 대상 컴포넌트를 선택하세요."
                    : "항목을 선택해 속성을 편집하거나 상위 경계의 제목으로 끌어 소속을 변경하세요."}
                </p>
                <NetworkLayout
                  fit={fitBoundary}
                  model={model}
                  selected={selected}
                  readonly={readonly}
                  onSelect={select}
                  onPlace={(child, field, parent) => {
                    change({
                      ...model,
                      nodes: model.nodes.map((n) =>
                        n.id === child.id
                          ? { ...n, props: { ...n.props, [field]: parent.id } }
                          : n,
                      ),
                    });
                    setSelected(child.id);
                  }}
                />
              </>
            ) : (
              <>
                <div className="arch-canvas-tools">
                  <span>
                    {connecting
                      ? "연결할 대상 컴포넌트를 클릭하세요."
                      : "끌어서 배치 · 컴포넌트를 선택해 속성 편집"}
                  </span>
                  <button
                    aria-label="아키텍처 축소"
                    onClick={() => setZoom(Math.max(0.4, zoom - 0.1))}
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    aria-label="아키텍처 확대"
                    onClick={() => setZoom(Math.min(1.6, zoom + 0.1))}
                  >
                    <ZoomIn size={15} />
                  </button>
                  <button
                    onClick={() =>
                      setZoom(
                        Math.max(
                          0.4,
                          Math.min(
                            1.6,
                            (viewport.current?.clientWidth || 900) / width,
                          ),
                        ),
                      )
                    }
                  >
                    맞춤
                  </button>
                  <button
                    disabled={readonly}
                    onClick={() => change(layoutArchitecture(model))}
                  >
                    정렬
                  </button>
                </div>
                <div
                  className="arch-viewport"
                  ref={viewport}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const k = e.dataTransfer.getData(
                      "application/x-xdocs-component",
                    );
                    if (COMPONENTS[k]) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      add(
                        k,
                        Math.max(
                          0,
                          (e.clientX - rect.left + e.currentTarget.scrollLeft) /
                            zoom,
                        ),
                        Math.max(
                          0,
                          (e.clientY - rect.top + e.currentTarget.scrollTop) /
                            zoom,
                        ),
                      );
                    }
                  }}
                >
                  <div style={{ width: width * zoom, height: height * zoom }}>
                    <div
                      className="arch-canvas"
                      style={{ width, height, transform: `scale(${zoom})` }}
                      onPointerMove={(e) => {
                        if (drag)
                          setDrag({
                            ...drag,
                            x: Math.max(
                              0,
                              Math.min(
                                9000,
                                drag.originX + (e.clientX - drag.startX) / zoom,
                              ),
                            ),
                            y: Math.max(
                              0,
                              Math.min(
                                9000,
                                drag.originY + (e.clientY - drag.startY) / zoom,
                              ),
                            ),
                          });
                      }}
                      onPointerUp={() => {
                        if (drag) {
                          if (
                            drag.x !== drag.originX ||
                            drag.y !== drag.originY
                          )
                            change({
                              ...model,
                              nodes: model.nodes.map((n) =>
                                n.id === drag.id
                                  ? {
                                      ...n,
                                      x: Math.round(drag.x / 10) * 10,
                                      y: Math.round(drag.y / 10) * 10,
                                    }
                                  : n,
                              ),
                            });
                          setDrag(null);
                        }
                      }}
                      onPointerCancel={() => setDrag(null)}
                    >
                      <svg className="arch-edges" width={width} height={height}>
                        <defs>
                          <marker
                            id="arch-arrow"
                            markerWidth="8"
                            markerHeight="8"
                            refX="7"
                            refY="4"
                            orient="auto"
                          >
                            <path d="M0,0 L8,4 L0,8" />
                          </marker>
                        </defs>
                        {edges.map((e: any, i: number) => {
                          const a = model.nodes.find((n) => n.id === e.source),
                            b = model.nodes.find((n) => n.id === e.target);
                          if (!a || !b) return null;
                          return (
                            <path
                              key={i}
                              d={architectureConnection(
                                drag?.id === a.id
                                  ? { ...a, x: drag.x, y: drag.y }
                                  : a,
                                drag?.id === b.id
                                  ? { ...b, x: drag.x, y: drag.y }
                                  : b,
                              )}
                              markerEnd="url(#arch-arrow)"
                            >
                              <title>{a.label + " → " + b.label}</title>
                            </path>
                          );
                        })}
                      </svg>
                      {model.nodes.map((n) => {
                        const Icon = icon(n.kind),
                          bad = issues.some((i) => i.id === n.id);
                        return (
                          <button
                            key={n.id}
                            aria-label={"컴포넌트 " + n.label}
                            className={
                              "arch-node " +
                              (selected === n.id ? "selected " : "") +
                              (bad ? "invalid" : "")
                            }
                            style={{
                              left: drag?.id === n.id ? drag.x : n.x,
                              top: drag?.id === n.id ? drag.y : n.y,
                            }}
                            onClick={() => select(n)}
                            onPointerDown={(e) => {
                              if (readonly || connecting || e.button !== 0)
                                return;
                              e.currentTarget.setPointerCapture(e.pointerId);
                              setSelected(n.id);
                              setDrag({
                                id: n.id,
                                x: n.x,
                                y: n.y,
                                startX: e.clientX,
                                startY: e.clientY,
                                originX: n.x,
                                originY: n.y,
                              });
                            }}
                            onKeyDown={(e) => {
                              if (
                                readonly ||
                                ![
                                  "ArrowLeft",
                                  "ArrowRight",
                                  "ArrowUp",
                                  "ArrowDown",
                                ].includes(e.key)
                              )
                                return;
                              e.preventDefault();
                              change({
                                ...model,
                                nodes: model.nodes.map((x) =>
                                  x.id === n.id
                                    ? {
                                        ...x,
                                        x: Math.max(
                                          0,
                                          x.x +
                                            (e.key === "ArrowRight"
                                              ? 10
                                              : e.key === "ArrowLeft"
                                                ? -10
                                                : 0),
                                        ),
                                        y: Math.max(
                                          0,
                                          x.y +
                                            (e.key === "ArrowDown"
                                              ? 10
                                              : e.key === "ArrowUp"
                                                ? -10
                                                : 0),
                                        ),
                                      }
                                    : x,
                                ),
                              });
                            }}
                          >
                            <Icon size={22} />
                            <span>
                              <strong>{n.label}</strong>
                              <small>
                                {n.imported
                                  ? "Terraform 원본"
                                  : COMPONENTS[n.kind]?.group}
                              </small>
                            </span>
                            {bad && <b title="설정 필요">!</b>}
                          </button>
                        );
                      })}
                      {!model.nodes.length && (
                        <div className="arch-empty">
                          <Box size={35} />
                          <h3>아키텍처를 그려보세요</h3>
                          <p>왼쪽 컴포넌트를 클릭하거나 이곳으로 끌어오세요.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <aside className="arch-properties">
            {node ? (
              <>
                <header>
                  <strong>컴포넌트 속성</strong>
                  <button
                    aria-label="컴포넌트 삭제"
                    disabled={readonly || node.imported}
                    onClick={() => {
                      change(removeComponent(model, node.id));
                      setSelected("");
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </header>
                <label>
                  표시 이름
                  <input
                    aria-label="컴포넌트 표시 이름"
                    readOnly={readonly}
                    value={node.label}
                    onChange={(e) => updateNode({ label: e.target.value })}
                  />
                </label>
                <p className="small-text muted">{node.address || node.kind}</p>
                {AVM_MODULES[node.kind as keyof typeof AVM_MODULES] && (
                  <p className="arch-module">
                    {AVM_MODULES[node.kind as keyof typeof AVM_MODULES].source}
                    <br />
                    고정 버전{" "}
                    {AVM_MODULES[node.kind as keyof typeof AVM_MODULES].version}
                  </p>
                )}
                {Object.entries(COMPONENTS[node.kind]?.fields || {})
                  .filter(
                    ([k]) => !node.imported || Object.hasOwn(node.props, k),
                  )
                  .map(([k, f]: [string, any]) => (
                    <label key={k}>
                      {f.label}
                      {f.ref ? (
                        <select
                          aria-label={f.label}
                          disabled={readonly}
                          value={node.props[k] || ""}
                          onChange={(e) =>
                            updateNode({
                              props: { ...node.props, [k]: e.target.value },
                            })
                          }
                        >
                          <option value="">연결할 대상 선택</option>
                          {model.nodes
                            .filter((n) => n.kind === f.ref)
                            .map((n) => (
                              <option value={n.id} key={n.id}>
                                {n.label} · {n.props.name}
                              </option>
                            ))}
                        </select>
                      ) : f.options ? (
                        <select
                          aria-label={f.label}
                          disabled={readonly}
                          value={node.props[k]}
                          onChange={(e) =>
                            updateNode({
                              props: { ...node.props, [k]: e.target.value },
                            })
                          }
                        >
                          {f.options.map((o: string) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : f.json ? (
                        <textarea
                          aria-label={f.label}
                          readOnly={readonly}
                          value={node.props[k]}
                          onChange={(e) =>
                            updateNode({
                              props: { ...node.props, [k]: e.target.value },
                            })
                          }
                        />
                      ) : (
                        <input
                          aria-label={f.label}
                          readOnly={readonly}
                          value={node.props[k] || ""}
                          onChange={(e) =>
                            updateNode({
                              props: { ...node.props, [k]: e.target.value },
                            })
                          }
                        />
                      )}
                    </label>
                  ))}
                {node.imported ? (
                  <p className="small-text muted">
                    원본 리소스·참조를 보존합니다. 표시된 단순 속성만 override
                    파일로 수정하며, 표현식·중첩 설정은 원본에서 수정 후 다시
                    가져오세요.
                  </p>
                ) : (
                  <button
                    className="button"
                    disabled={readonly}
                    onClick={() => setConnecting(!connecting)}
                  >
                    <Link2 size={14} />
                    {connecting ? "연결 취소" : "대상 클릭으로 연결"}
                  </button>
                )}
                {issues
                  .filter((i) => i.id === node.id)
                  .map((i, index) => (
                    <p className="arch-issue" key={index}>
                      {i.message}
                    </p>
                  ))}
                <details>
                  <summary>참조하는 대상</summary>
                  {edges
                    .filter((e) => e.source === node.id)
                    .map((e: any, i: number) => (
                      <p key={i}>
                        {model.nodes.find((n) => n.id === e.target)?.label}{" "}
                        {!e.locked && (
                          <button
                            disabled={readonly}
                            onClick={() =>
                              updateNode({
                                props: { ...node.props, [e.field]: "" },
                              })
                            }
                          >
                            연결 해제
                          </button>
                        )}
                      </p>
                    ))}
                </details>
              </>
            ) : (
              <p className="muted">컴포넌트를 선택하세요.</p>
            )}
            <details className="arch-environment">
              <summary>클라우드 환경 설정</summary>
              {[
                ["aws_region", "AWS Region"],
                ["azure_subscription", "Azure Subscription ID"],
                ["gcp_project", "GCP Project ID"],
                ["gcp_region", "GCP Region"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    readOnly={readonly}
                    value={model.settings[key] || ""}
                    onChange={(e) =>
                      change({
                        ...model,
                        settings: { ...model.settings, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
              <p className="small-text muted">
                인증정보는 저장하지 않습니다. 계정 ID는 예제 변수 파일에
                포함됩니다.
              </p>
            </details>
          </aside>
        </div>
      )}
      {tab === "code" && (
        <section className="arch-export">
          <div className="infra-actions">
            <select
              aria-label="아키텍처 추출 형식"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {[
                ["all", "전체 묶음"],
                ["terraform", "Terraform (.tf.json / 원본 .tf)"],
                ["cloudformation", "AWS CloudFormation"],
                ["manifest", "Kubernetes manifest"],
                ["helm", "Helm chart"],
              ].map(([v, t]) => (
                <option value={v} key={v}>
                  {t}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={only}
                disabled={!node}
                onChange={(e) => setOnly(e.target.checked)}
              />
              선택 컴포넌트 + 의존 대상
            </label>
            <button
              className="button primary"
              disabled={!!result.errors.length}
              onClick={() => void download()}
            >
              <Download size={15} />
              코드 ZIP 내보내기
            </button>
          </div>
          {result.errors.map((e, i) => (
            <p role="alert" key={i}>
              {e}
            </p>
          ))}
          {result.warnings.map((e, i) => (
            <p className="small-text muted" key={i}>
              {e}
            </p>
          ))}
          <p className="small-text muted">
            계획과 배포는 실행하지 않습니다. 추출 후 Terraform validate, Helm
            lint와 대상 환경 검토를 진행하세요.
          </p>
          <div className="infra-actions">
            <button
              className="button"
              aria-expanded={comparison}
              onClick={() => setComparison(!comparison)}
            >
              IaC 변경 비교
            </button>
            {comparison && (
              <>
                <small>
                  비교 기준 · {customBase ? "지정한 시점" : "페이지를 연 시점"}
                </small>
                <button
                  className="text-button"
                  disabled={!!result.errors.length}
                  onClick={() => {
                    setBaseline(model);
                    setCustomBase(true);
                  }}
                >
                  현재 설계를 기준으로 지정
                </button>
              </>
            )}
          </div>
          {comparison && (
            <IacDiff
              baseline={baseline}
              format={format}
              ids={only && node ? [node.id] : []}
              files={result.files}
              errors={result.errors}
            />
          )}
          {!comparison && activeFile && (
            <div className="arch-code">
              <nav>
                {fileNames.map((n) => (
                  <button
                    className={n === activeFile ? "active" : ""}
                    key={n}
                    onClick={() => setFile(n)}
                  >
                    {n}
                  </button>
                ))}
              </nav>
              <div>
                <header>
                  <strong>{activeFile}</strong>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          result.files[activeFile],
                        );
                        setStatus("코드를 복사했습니다.");
                      } catch {
                        setError("클립보드에 접근할 수 없습니다.");
                      }
                    }}
                  >
                    <Copy size={14} />
                    복사
                  </button>
                </header>
                <pre aria-label="생성 코드">{result.files[activeFile]}</pre>
              </div>
            </div>
          )}
        </section>
      )}
      {tab === "review" && (
        <section className="arch-review">
          <h2>Well-Architected 설계 검토</h2>
          <p>
            AVM 사용은 전체 워크로드의 WAF 준수나 인증을 의미하지 않습니다. 자동
            합격 점수 대신 근거와 남은 검토 사항을 기록합니다.
          </p>
          {architectureReview(model).map((p) => (
            <article key={p.id}>
              <h3>{p.label}</h3>
              <p>{p.prompt}</p>
              {p.observations.map((o: string) => (
                <p className="arch-observation" key={o}>
                  {o}
                </p>
              ))}
              <textarea
                aria-label={p.label + " 검토 기록"}
                placeholder="설계 결정, 근거, 검토 담당자와 후속 작업…"
                readOnly={readonly}
                value={p.note}
                onChange={(e) =>
                  change({
                    ...model,
                    review: { ...model.review, [p.id]: e.target.value },
                  })
                }
              />
            </article>
          ))}
          <a
            href="https://learn.microsoft.com/azure/well-architected/"
            target="_blank"
            rel="noreferrer"
          >
            Microsoft Well-Architected Framework
          </a>
        </section>
      )}
    </section>
  );
}
