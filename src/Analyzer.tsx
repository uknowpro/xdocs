import { useState } from "react";
import { api } from "./api";
import { analyzerReport, analyzerMarkdown } from "../shared/analyzer.mjs";
type Report = ReturnType<typeof analyzerReport>;
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
  const edit = (key: string, value: string | boolean) =>
    onSettings({ ...settings, [key]: value });
  const [result, setResult] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [pathLimit, setPathLimit] = useState(25),
    [findingLimit, setFindingLimit] = useState(100);
  async function load(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      const raw = await fn();
      if (raw !== null) {
        setResult(analyzerReport(raw));
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
          <select value={mode} onChange={(e) => edit("mode", e.target.value)}>
            {Object.entries({
              network: "프로젝트 네트워크",
              "helm-network": "Helm 네트워크",
              manifest: "매니페스트 호환성",
              helm: "Helm 호환성",
              upgrade: "매니페스트 업그레이드",
              "helm-upgrade": "Helm 업그레이드 비교",
            }).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
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
              void load(() =>
                api.analyzeDirectory!({
                  mode,
                  from,
                  to,
                  release,
                  namespace,
                  customValues,
                }),
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
          {result.rules && <p>규칙 {result.rules}</p>}
          {result.steps.length > 0 && <p>{result.steps.join(" → ")}</p>}
          {result.paths.slice(0, pathLimit).map((p, i) => (
            <details key={i} open>
              <summary>
                {p.status} · 경로 {i + 1}
              </summary>
              <ol className="analyzer-path">
                {p.nodes.map((n, j) => (
                  <li key={j}>{n}</li>
                ))}
              </ol>
              <small>{p.evidence.join(" · ")}</small>
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
              <li key={i}>{row.filter(Boolean).join(" · ")}</li>
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
