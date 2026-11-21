import { AnalyzerEvidence } from "./AnalyzerEvidence";
import { useMemo, useState } from "react";
import { api } from "./api";
import { analyzerReport, analyzerMarkdown } from "../shared/analyzer.mjs";
type Report = ReturnType<typeof analyzerReport>;
function NetworkPath({
  path,
  local,
}: {
  path: Report["paths"][number];
  local: boolean;
}) {
  const [edge, setEdge] = useState<number | null>(null);
  const matched = edge === null ? [] : path.edgeEvidence[edge-1] || [];
  const evidence = matched.length ? matched : path.evidence.map((_,i)=>i);
  return (
    <>
      <ol className="analyzer-path" data-inferred={/inferred|candidate|unresolved|partial/.test(path.status)}>
        {path.nodes.map((node, index) => (
          <li key={index}>
            {index > 0 &&
              (path.evidence.length ? (
                <button
                  type="button"
                  className="path-link"
                  aria-pressed={edge === index}
                  aria-label={
                    path.nodes[index - 1] + " → " + node + " 경로 근거"
                  }
                  onClick={() => setEdge(edge === index ? null : index)}
                >
                  →
                </button>
              ) : (
                <span aria-hidden="true">→ </span>
              ))}
            {node}
          </li>
        ))}
      </ol>
      {edge !== null && <small>{matched.length ? "선택한 연결의 근거" : "이 경로의 근거"}</small>}
      {evidence.map((j,i) => (
        <AnalyzerEvidence
          key={String(edge) + ":" + j}
          initiallyOpen={edge !== null && i === 0}
          evidence={path.evidence[j]}
          source={local ? path.sources[j] : undefined}
        />
      ))}
    </>
  );
}
export default function Analyzer({
  readonly,
  settings,
  onSettings,
  onSave,
}: {
  settings: Record<string, any>;
  onSettings: (s: Record<string, any>) => void;
  readonly: boolean;
  onSave: (title: string, body: string) => Promise<void>;
}) {
  const { mode, from, to, release, namespace, customValues } = settings;
  const category = mode === "helm-network" ? "network" : mode === "helm-upgrade" ? "upgrade" : mode;
  const edit = (key: string, value: string | boolean) =>
    onSettings({ ...settings, [key]: value });
  const [result, setResult] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [pathLimit, setPathLimit] = useState(25),
    [findingLimit, setFindingLimit] = useState(100);
  const [previous,setPrevious]=useState<Report|null>(null);
  const [localScan, setLocalScan] = useState(false);
  const pathsByEvidence = useMemo(() => {
    const index = new Map<string,number[]>();
    result?.paths.forEach((path,i)=>new Set<string>(path.evidence).forEach(key=>{
      if (key) index.set(key,[...(index.get(key)||[]),i]);
    }));
    return index;
  },[result]);
  async function load(fn: () => Promise<unknown>, local = false) {
    setBusy(true);
    setError("");
    try {
      const raw = await fn();
      if (raw !== null) {
        const next=analyzerReport(raw);
        setPrevious(result?.title===next.title ? result : null);
        setResult(next);
        setLocalScan(local);
        setPathLimit(25);
        setFindingLimit(100);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="builder-panel analyzer">
      <h2>Analyzer</h2>
      <fieldset disabled={busy || readonly}>
        <legend>프로젝트 분석</legend>
        <label>
          분석 종류
          <select value={category} onChange={(e) => edit("mode", e.target.value)}>
            <option value="network">네트워크</option>
            <option value="helm">Helm</option>
            <option value="manifest">Manifest</option>
            <option value="upgrade">쿠버네티스 업그레이드</option>
          </select>
        </label>
        {(category === "network" || category === "upgrade") && (
          <label>
            분석 대상
            <select value={mode} onChange={(e) => edit("mode", e.target.value)}>
              <option value={category}>{category === "network" ? "프로젝트" : "Manifest"}</option>
              <option value={category === "network" ? "helm-network" : "helm-upgrade"}>Helm 차트</option>
            </select>
          </label>
        )}
        {mode.endsWith("upgrade") && (
          <label>
            시작 Kubernetes 버전
            <input
              value={from}
              onChange={(e) => edit("from", e.target.value)}
            />
          </label>
        )}
        {mode !== "network" && (
          <label>
            목표 Kubernetes 버전
            <input value={to} onChange={(e) => edit("to", e.target.value)} />
          </label>
        )}
        {mode.startsWith("helm") && (
          <>
            <label>
              릴리스
              <input
                value={release}
                onChange={(e) => edit("release", e.target.value)}
              />
            </label>
            <label>
              네임스페이스
              <input
                value={namespace}
                onChange={(e) => edit("namespace", e.target.value)}
              />
            </label>
            <label>
              <span>
                <input
                  type="checkbox"
                  checked={customValues}
                  onChange={(e) => edit("customValues", e.target.checked)}
                />{" "}
                별도 values 파일 선택
              </span>
            </label>
          </>
        )}
        {api.analyzeDirectory ? (
          <button
            onClick={() =>
              void load(
                () =>
                  api.analyzeDirectory!({
                    mode,
                    from,
                    to,
                    release,
                    namespace,
                    customValues,
                  }),
                true,
              )
            }
          >
            폴더 선택 및 분석
          </button>
        ) : (
          <p>프로젝트 폴더 분석은 데스크톱 앱에서 실행합니다.</p>
        )}
        <label>
          기존 분석 JSON 열기
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f)
                void load(async () => {
                  if (f.size > 8 * 1024 * 1024)
                    throw Error("8MB 이하의 보고서를 선택하세요.");
                  return JSON.parse(await f.text());
                });
            }}
          />
        </label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <h3>
            {result.title} {result.version}
          </h3>
          {previous && <details><summary>직전 분석과 변경 비교</summary>
            {(["추가","해소"] as const).map(label=>{
              const [left,right]=label==="추가"?[result,previous]:[previous,result];
              const entries=(r:Report)=>[...r.rows.map(row=>JSON.stringify(row)),...r.paths.map(p=>JSON.stringify([p.status,...p.nodes,...p.evidence]))];
              const other=new Set(entries(right)), changed=[...new Set(entries(left))].filter(v=>!other.has(v));
              return <section key={label}><strong>{label} {changed.length}건</strong><ul>{changed.map(v=><li key={v}>{JSON.parse(v).filter(Boolean).join(" · ")}</li>)}</ul></section>
            })}</details>}
          {result.rules && <p>규칙 {result.rules}</p>}
          {result.steps.length > 0 && <p>{result.steps.join(" → ")}</p>}
          {result.paths.slice(0, pathLimit).map((p, i) => (
            <details key={i} id={"network-path-"+i} open>
              <summary>
                {p.status} · 경로 {i + 1}
              </summary>
              <NetworkPath
                key={p.sources[0]?.session || p.evidence.join("|")}
                path={p}
                local={localScan}
              />
            </details>
          ))}
          {pathLimit < result.paths.length && (
            <button onClick={() => setPathLimit((n) => n + 25)}>
              경로 더 보기 ({pathLimit}/{result.paths.length})
            </button>
          )}
          <h3>발견 및 조치 · {result.rows.length}건</h3>
          <ul>
            {result.rows.slice(0, findingLimit).map((row, i) => (
              <li key={i}>
                {row.filter(Boolean).join(" · ")}
                {pathsByEvidence.get(row[3])?.map(index => <button key={index} type="button" onClick={()=>{
                  setPathLimit(limit=>Math.max(limit,index+1));
                  requestAnimationFrame(()=>{
                    const target=document.getElementById("network-path-"+index) as HTMLDetailsElement | null;
                    if (target) {target.open=true;target.scrollIntoView({block:"center"});target.querySelector("summary")?.focus({preventScroll:true});}
                  });
                }}>경로 {index+1} 보기</button>)}
                {localScan && result.rowSources[i] && (
                  <AnalyzerEvidence
                    key={result.rowSources[i].session}
                    evidence={row[3]}
                    source={result.rowSources[i]}
                  />
                )}
              </li>
            ))}
          </ul>
          {findingLimit < result.rows.length && (
            <button onClick={() => setFindingLimit((n) => n + 100)}>
              발견 더 보기 ({findingLimit}/{result.rows.length})
            </button>
          )}
          {result.notes.length > 0 && (
            <details>
              <summary>검사 범위 및 진단</summary>
              {result.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </details>
          )}
          <button
            disabled={readonly || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(result.title, analyzerMarkdown(result));
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            보고서를 하위 노트로 저장
          </button>
        </>
      )}
    </section>
  );
}
