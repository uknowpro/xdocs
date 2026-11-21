import { useEditorPosition } from "./useEditorPosition";
import { useEffect, useState } from "react";
import {
  Network,
  List,
  RefreshCw,
  FileText,
  Copy,
  X,
  Plus,
  Upload,
} from "lucide-react";
import { api } from "./api";
import {
  compareInfrastructure,
  infrastructureMarkdown,
  infrastructureTemplate,
  infrastructureExample,
} from "../shared/infrastructure.mjs";
import { toTSV } from "../shared/tabular.mjs";
import { selectedTableTSV } from "./tableClipboard";
export interface InfrastructureResource {
  id: string;
  kind: string;
  name: string;
  scope: string;
  dependencies: string[];
  properties: Record<string, string | number | boolean>;
  actions: string[];
}
export interface InfrastructureSnapshot {
  version: 1;
  format: "terraform" | "kubernetes" | "compose";
  source: string;
  importedAt: string;
  resources: InfrastructureResource[];
  warnings: string[];
  notes: Record<string, string>;
}
const formatNames = {
  terraform: "Terraform / OpenTofu",
  kubernetes: "Kubernetes",
  compose: "Docker Compose",
};
const changeNames = { added: "추가", changed: "변경", removed: "제거" };
export function InfrastructureStart({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (snapshot: InfrastructureSnapshot) => Promise<void>;
}) {
  const [preview, setPreview] = useState<InfrastructureSnapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="overlay">
      <section
        className="dialog infrastructure-start"
        role="dialog"
        aria-label="인프라 문서 만들기"
      >
        <header>
          <h2>인프라 문서 만들기</h2>
          <button
            className="icon-button"
            aria-label="인프라 가져오기 닫기"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <p>구성 파일에서 리소스와 관계를 읽고, 운영 지식을 함께 보관하세요.</p>
        <div className="infra-formats">
          <span>Terraform / OpenTofu JSON</span>
          <span>Kubernetes YAML</span>
          <span>Compose YAML</span>
        </div>
        <p className="muted small-text">
          로컬 파일을 읽습니다. 명령 실행·배포·클라우드 연결은 하지 않습니다.
          Secret과 환경변수 값은 가져오지 않습니다.
        </p>
        <div className="infra-actions">
          <button
            className="button primary"
            disabled={busy || !api.importInfrastructure}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const next = await api.importInfrastructure!();
                if (next) setPreview(next);
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Upload size={15} />
            파일 선택
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              setPreview(
                infrastructureExample() as unknown as InfrastructureSnapshot,
              )
            }
          >
            예제로 살펴보기
          </button>
        </div>
        {!api.importInfrastructure && (
          <p className="muted small-text">
            파일 가져오기는 데스크톱 앱에서 사용할 수 있습니다.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {preview && (
          <div className="infra-preview">
            <strong>{preview.source}</strong>
            <p>
              {formatNames[preview.format]} · {preview.resources.length}개
              리소스 ·{" "}
              {preview.resources.reduce((n, r) => n + r.dependencies.length, 0)}
              개 관계
            </p>
            <ul>
              {preview.resources.slice(0, 8).map((r) => (
                <li key={r.id}>{r.id}</li>
              ))}
            </ul>
            <p className="small-text muted">
              원본 파일을 첨부하지 않고 아래 범위의 요약만 저장합니다.
            </p>
            {preview.warnings.map((w) => (
              <p className="small-text muted" key={w}>
                {w}
              </p>
            ))}
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onCreate(preview);
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus size={15} />
              인프라 노트 생성
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
export default function InfrastructureDocument({
  snapshot,
  onChange,
  onCreateNote,
  readonly = false,
}: {
  snapshot: InfrastructureSnapshot;
  onChange: (snapshot: InfrastructureSnapshot) => void;
  onCreateNote: (title: string, body: string) => Promise<void>;
  readonly?: boolean;
}) {
  const [tab, setTab] = useState<"inventory" | "relations" | "notes" | "source">(
      "inventory",
    ),
    [filter, setFilter] = useState(""),
    [selected, setSelected] = useState(snapshot.resources[0]?.id || ""),
    [page, setPage] = useState(0),
    [incoming, setIncoming] = useState<InfrastructureSnapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const resource =
    snapshot.resources.find((r) => r.id === selected) || snapshot.resources[0];
  const memoEditor=useEditorPosition(resource?.id || "");
  const [sourceFiles,setSourceFiles]=useState<File[]>([]);
  const [sourceIndex,setSourceIndex]=useState(0);
  const [sourceText,setSourceText]=useState<{file:File;text:string}>();
  const sourceFile=sourceFiles[sourceIndex];
  useEffect(()=>{
    if (!sourceFile) return;
    let current=true;
    sourceFile.text().then(text=>{if (current) setSourceText({file:sourceFile,text});},
      reason=>{if (current) setError(String(reason));});
    return ()=>{current=false;};
  },[sourceFile]);
  const sourceReady=sourceFile && sourceText?.file===sourceFile;
  const sourceEditor=useEditorPosition(tab==="source" && sourceReady ? String(sourceIndex) : "");

  const filtered = snapshot.resources.filter((r) =>
    (r.id + " " + r.kind + " " + r.scope)
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const changes = incoming ? compareInfrastructure(snapshot, incoming) : [];
  const neighbors = new Set([
    resource?.id,
    ...(resource?.dependencies || []),
    ...snapshot.resources
      .filter((r) => r.dependencies.includes(resource?.id))
      .map((r) => r.id),
  ]);
  const graph = snapshot.resources
    .filter((r) => neighbors.has(r.id))
    .slice(0, 40);
  const positions = new Map(
    graph.map((r, i) => [
      r.id,
      {
        x: 50 + Math.cos((i / Math.max(graph.length, 1)) * Math.PI * 2) * 35,
        y: 50 + Math.sin((i / Math.max(graph.length, 1)) * Math.PI * 2) * 34,
      },
    ]),
  );
  async function create(type: string) {
    setBusy(true);
    setError("");
    try {
      const note =
        type === "inventory"
          ? {
              title: "리소스 목록",
              body: "# 리소스 목록\n\n" + infrastructureMarkdown(snapshot),
            }
          : infrastructureTemplate(type, resource);
      await onCreateNote(note.title, note.body);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="infrastructure-document" aria-label="인프라 문서">
      <div className="infra-heading">
        <div>
          <span className="eyebrow">INFRASTRUCTURE AS DOCUMENTATION</span>
          <h1>{formatNames[snapshot.format]}</h1>
          <p className="muted">
            {snapshot.source} · {new Date(snapshot.importedAt).toLocaleString()}
          </p>
        </div>
        <button
          className="button"
          disabled={readonly || busy || !api.importInfrastructure}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const next = await api.importInfrastructure!();
              if (next) {
                compareInfrastructure(snapshot, next);
                setIncoming(next);
              }
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw size={15} />
          다시 가져와 비교
        </button>
      </div>
      <div className="infra-summary">
        <div>
          <strong>{snapshot.resources.length}</strong>
          <span>리소스</span>
        </div>
        <div>
          <strong>
            {snapshot.resources.reduce((n, r) => n + r.dependencies.length, 0)}
          </strong>
          <span>참조 관계</span>
        </div>
        <div>
          <strong>
            {
              snapshot.resources.filter((r) =>
                r.actions.some((a) => a !== "no-op"),
              ).length
            }
          </strong>
          <span>계획 작업</span>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {incoming && (
        <section className="infra-comparison" aria-label="인프라 변경 비교">
          <h3>이전 가져오기와 비교</h3>
          <p>
            {changes.filter((c) => c.kind === "added").length}개 추가 ·{" "}
            {changes.filter((c) => c.kind === "changed").length}개 변경 ·{" "}
            {changes.filter((c) => c.kind === "removed").length}개 제거
          </p>
          <p className="small-text muted">
            허용된 요약 필드의 차이입니다. 실제 인프라의 드리프트 검사나 배포
            결과가 아닙니다.
          </p>
          <ul>
            {changes.slice(0, 100).map((c) => (
              <li key={c.id}>
                {changeNames[c.kind as keyof typeof changeNames]} · {c.id}
              </li>
            ))}
          </ul>
          {changes.length > 100 && <p>처음 100개 변경을 표시합니다.</p>}
          <div className="infra-actions">
            <button
              className="button primary"
              disabled={readonly}
              onClick={() => {
                try {
                  onChange({ ...incoming, notes: snapshot.notes || {} });
                  setIncoming(null);
                  setPage(0);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              새 스냅샷 적용
            </button>
            <button className="button" onClick={() => setIncoming(null)}>
              비교 닫기
            </button>
          </div>
        </section>
      )}
      <div className="infra-toolbar">
        <div className="segmented" role="tablist" aria-label="인프라 보기">
          <button
            role="tab"
            aria-selected={tab === "inventory"}
            onClick={() => setTab("inventory")}
          >
            <List size={14} />
            목록
          </button>
          <button
            role="tab"
            aria-selected={tab === "relations"}
            onClick={() => setTab("relations")}
          >
            <Network size={14} />
            관계
          </button>
          <button
            role="tab"
            aria-selected={tab === "notes"}
            onClick={() => setTab("notes")}
          >
            <FileText size={14} />
            운영 메모
          </button>
          <button role="tab" aria-selected={tab==="source"} onClick={()=>setTab("source")}>원문</button>
        </div>
        <input
          aria-label="인프라 리소스 검색"
          placeholder="리소스·종류·범위 검색"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        />
        <button
          className="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                toTSV([
                  ["리소스", "종류", "범위", "참조"],
                  ...filtered.map((r) => [
                    r.id,
                    r.kind,
                    r.scope,
                    r.dependencies.join(", "),
                  ]),
                ]),
              );
              setMessage("목록을 탭 구분으로 복사했습니다.");
            } catch {
              setError("표를 선택한 후 Ctrl/⌘ C로 복사해 주세요.");
            }
          }}
        >
          <Copy size={14} />
          목록 복사
        </button>
      </div>
      {tab === "inventory" && (
        <>
          <div
            className="infra-table"
            onCopy={(e) => {
              const value = selectedTableTSV(e.currentTarget);
              if (value !== null) {
                e.preventDefault();
                e.clipboardData.setData("text/plain", value);
              }
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>리소스</th>
                  <th>종류</th>
                  <th>범위</th>
                  <th>계획 작업</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(page * 100, (page + 1) * 100).map((r) => (
                  <tr
                    key={r.id}
                    className={resource?.id === r.id ? "active" : ""}
                  >
                    <td>
                      <button onClick={() => setSelected(r.id)}>{r.id}</button>
                    </td>
                    <td>{r.kind}</td>
                    <td>{r.scope}</td>
                    <td>{r.actions.join(" → ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <div className="sheet-pages">
              <button disabled={!page} onClick={() => setPage(page - 1)}>
                이전
              </button>
              <span>
                {page + 1} / {Math.ceil(filtered.length / 100)}
              </span>
              <button
                disabled={(page + 1) * 100 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
      {tab === "relations" && (
        <>
          <label className="infra-focus">
            중심 리소스
            <select
              aria-label="관계 중심 리소스"
              value={resource?.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {filtered.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id}
                </option>
              ))}
            </select>
          </label>
          <div className="infra-graph" aria-label="리소스 관계 그래프">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {graph.flatMap((r) =>
                r.dependencies.map((dep) => {
                  const a = positions.get(r.id),
                    b = positions.get(dep);
                  return a && b ? (
                    <line
                      key={r.id + "-" + dep}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                    />
                  ) : null;
                }),
              )}
            </svg>
            {graph.map((r) => {
              const p = positions.get(r.id)!;
              return (
                <button
                  key={r.id}
                  style={{ left: p.x + "%", top: p.y + "%" }}
                  className={r.id === resource.id ? "active" : ""}
                  title={r.id}
                  onClick={() => setSelected(r.id)}
                >
                  <strong>{r.name}</strong>
                  <small>{r.kind}</small>
                </button>
              );
            })}
          </div>
          <p className="small-text muted">
            선택한 리소스 주변 최대 40개를 표시합니다. 연결 방향과 파일에 없는
            참조는 아래 목록에서 확인하세요.
          </p>
        </>
      )}
      {tab==="source" && <section className="infra-source">
        <label>로컬 원문 열기 <input type="file" multiple accept=".tf,.json,.yaml,.yml" onChange={event=>{
          const files=Array.from(event.target.files || []);
          event.target.value="";
          if (!files.length) return;
          if (files.some(f=>f.size>4_000_000)) {setError("4MB 이하의 원문 파일을 선택하세요.");return;}
          setSourceIndex(sourceFiles.length);setSourceFiles([...sourceFiles,...files]);setError("");
        }}/></label>
        {sourceFiles.length>0 && <label>열린 파일 <select value={sourceIndex} onChange={e=>setSourceIndex(Number(e.target.value))}>
          {sourceFiles.map((file,i)=><option key={i} value={i}>{file.name}</option>)}</select></label>}
        {sourceReady && <textarea key={sourceIndex} aria-label="인프라 파일 원문" ref={sourceEditor} readOnly wrap="off" value={sourceText.text}/>}
      </section>}
      {tab === "notes" && (
        <div className="infra-memos">
          {Object.entries(snapshot.notes || {})
            .filter(([, value]) => value)
            .map(([id, value]) => (
              <article key={id}>
                <strong>
                  {id}
                  {!snapshot.resources.some((r) => r.id === id) &&
                    " · 현재 스냅샷에 없음"}
                </strong>
                <pre>{value}</pre>
              </article>
            ))}
          {!Object.values(snapshot.notes || {}).some(Boolean) && (
            <p className="muted">
              리소스를 선택하고 아래에 운영 메모를 작성하세요.
            </p>
          )}
        </div>
      )}
      {resource && (
        <section className="infra-detail">
          <header>
            <h3>{resource.id}</h3>
            <span className="muted">{resource.kind}</span>
          </header>
          <dl>
            {Object.entries(resource.properties).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <div className="infra-dependencies">
            <strong>참조하는 대상</strong>
            {resource.dependencies.length ? (
              <ul>
                {resource.dependencies.map((dep) => (
                  <li key={dep}>
                    {snapshot.resources.some((r) => r.id === dep) ? (
                      <button
                        className="text-button"
                        onClick={() => setSelected(dep)}
                      >
                        {dep}
                      </button>
                    ) : (
                      <span>{dep} · 파일에 없음</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">명시된 참조가 없습니다.</p>
            )}
          </div>
          <label>
            운영 메모
            <textarea
              key={resource.id} ref={memoEditor} aria-label="리소스 운영 메모"
              placeholder="담당자, 역할, 점검 사항, 관련 문서…"
              value={snapshot.notes?.[resource.id] || ""}
              readOnly={readonly}
              onChange={(e) => {
                try {
                  onChange({
                    ...snapshot,
                    notes: { ...snapshot.notes, [resource.id]: e.target.value },
                  });
                } catch (error) {
                  setError(String(error));
                }
              }}
            />
          </label>
          <div className="infra-actions">
            <button
              className="button"
              disabled={readonly || busy}
              onClick={() => void create("runbook")}
            >
              운영 절차 노트 만들기
            </button>
            <button
              className="button"
              disabled={readonly || busy}
              onClick={() => void create("adr")}
            >
              설계 결정 노트 만들기
            </button>
            <button
              className="button"
              disabled={readonly || busy}
              onClick={() => void create("inventory")}
            >
              목록을 일반 노트로 복제
            </button>
          </div>
        </section>
      )}
      <details className="infra-scope">
        <summary>가져온 범위와 제외한 항목</summary>
        {snapshot.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
        <p>
          원본은 첨부하지 않습니다. 운영 메모와 요약은 이 노트의 저장 위치를
          따르므로 조직 보관함에서는 조직 서버로 동기화됩니다.
        </p>
      </details>
    </section>
  );
}
