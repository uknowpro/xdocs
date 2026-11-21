import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateEvidenceJson,
  publishedHarness,
  newBuilder,
  presets,
  skills,
  prompts,
  reviewSheet,
  decodeBuilder,
  encodeBuilder,
} from "../shared/builder.mjs";
import { decodeWorkbook } from "../shared/tabular.mjs";
import SkillFile from "./SkillFile";
import BuilderContext from "./BuilderContext";
import { api } from "./api";
import type { ModelProfile, Note } from "./types";
import type { SheetBook } from "./SheetTable";
type Rule = {
  label: string;
  kind: keyof typeof skills;
  column: number;
  threshold: number;
  keyword?: string;
  input?: "previous" | "source";
  stopOnEmpty?: boolean;
  instruction: string;
};
type Config = {
  outputFormat?: "text" | "evidence-json";
  version: number;
  source: string;
  input?: "note" | "sheet";
  origin?: { page: string; revision: string };
  sheet: string;
  rules: Rule[];
  prompt: string;
};
export default function Builder({
  config,
  notes,
  readonly,
  onChange,
  onSave,
  onCopy,
}: {
  config: Config;
  notes: Note[];
  readonly: boolean;
  onChange: (v: Config) => void;
  onSave: (content: string) => Promise<void>;
  onCopy: (title: string, c: Config, publish?: boolean) => Promise<void>;
}) {
  const [stepSource,setStepSource]=useState<Config|null>(null);
  const [copyTitle, setCopyTitle] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<{ id: string; book: SheetBook } | null>(
    null,
  );
  const [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const [endpoint, setEndpoint] = useState(
      "http://localhost:8000/v1/chat/completions",
    ),
    [model, setModel] = useState(""),
    [key, setKey] = useState("");
  const [profiles, setProfiles] = useState<ModelProfile[]>([]),
    [profile, setProfile] = useState(""),
    [remember, setRemember] = useState(false);
  useEffect(() => {
    let live = true;
    api
      .builderProfiles?.()
      .then((items) => {
        if (live) setProfiles(items);
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, []);
  const [comparison, setComparison] = useState<{
    label: string;
    input: string;
    text: string;
  } | null>(null);
  const [failedInput, setFailedInput] = useState<string | null>(null);
  const [alternate, setAlternate] = useState("");
  const [context, setContext] = useState("");
  const [reply, setReply] = useState<{ input: string; text: string; model: string } | null>(
    null,
  );
  const source = notes.find((n) => n.id === config.source);
  useEffect(() => {
    let ignore = false;
    setLoaded(null);
    setError("");
    if (source)
      (async () => {
        const note =
          source.unloaded && api.readNote
            ? await api.readNote(source.id)
            : source;
        const book =
          config.input === "note"
            ? {
                version: 1 as const,
                sheets: [
                  {
                    id: "lines",
                    name: note.title,
                    noteLines: true,
                    rows: [
                      ["본문"],
                      ...note.body.split(/\r?\n/).map((line) => [line]),
                    ],
                  },
                ],
              }
            : decodeWorkbook(note.body);
        if (!book) throw Error("시트 테이블 페이지를 선택하세요.");
        if (!ignore) setLoaded({ id: note.id, book });
      })().catch((e) => {
        if (!ignore) setError(String(e));
      });
    return () => {
      ignore = true;
    };
  }, [source?.id, source?.revision, config.input]);
  const book = loaded?.id === config.source ? loaded?.book : null;
  const sheet =
    book?.sheets.find((s) => s.id === config.sheet) ??
    (!config.sheet ? book?.sheets[0] : undefined);
  const columns = sheet
    ? sheet.rows.reduce((n, r) => Math.max(n, r.length), 1)
    : 0;
  const valid =
    !!sheet &&
    config.rules.length > 0 &&
    config.rules.every((r) => r.column < columns);
  const result = useMemo(
    () => (sheet && valid ? reviewSheet(sheet, config.rules) : null),
    [sheet, config.rules, valid],
  );
  const content = result ? JSON.stringify(result.findings, null, 2) : "";
  const input = [
    config.prompt,
    ...config.rules.map((r) => r.instruction),
    ...(context ? ["MCP 참고 자료", context] : []),
    ...(config.outputFormat === "evidence-json" ? ['JSON 객체 하나로 응답하세요. summary는 요약 문자열, evidence는 입력에 포함된 모든 고유 cell 주소의 문자열 배열입니다.'] : []),
    "입력 데이터",
    content,
  ].join("\n\n");
  const currentReply = reply?.input === input ? reply.text : "";
  const assessment = currentReply && config.outputFormat === "evidence-json" && result
    ? evaluateEvidenceJson(currentReply, result.findings) : null;
  const patch = (next: Partial<Config>) => onChange({ ...config, ...next });
  const updateRule = (i: number, next: Partial<Rule>) =>
    patch({
      rules: config.rules.map((r, j) => (j === i ? { ...r, ...next } : r)),
    });
  async function run(action: () => Promise<void>) {
    setError("");
    setWorking(true);
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setWorking(false);
    }
  }
  async function sendModel(target?: ModelProfile) {
    setReply(null);
    await run(async () => {
      try {
        const chosenModel = target?.model ?? model;
        const text = await api.builderModel!({
          endpoint: target?.endpoint ?? endpoint,
          model: chosenModel,
          key: target ? "" : key,
          profile: target?.name ?? profile,
          prompt: input,
        });
        setReply({ input, text, model: chosenModel });
        setFailedInput(null);
      } catch (e) {
        setFailedInput(input);
        throw e;
      }
    });
  }
  const alternatives = profiles.filter(p => p.endpoint !== endpoint || p.model !== model);
  const fallback = alternatives.find(p => p.name === alternate);
  return (
    <section className="builder-panel">
      <h2>Builder</h2>
      <details>
        <summary>하네스 공유와 복제</summary>
        {config.origin && (
          <small>
            원본 페이지 {config.origin.page} · 버전{" "}
            {config.origin.revision.slice(0, 12)}
          </small>
        )}
        <label>
          사본 이름
          <input
            value={copyTitle}
            onChange={(e) => setCopyTitle(e.target.value)}
            maxLength={100}
          />
        </label>
        <button
          disabled={working || readonly || !copyTitle.trim()}
          onClick={() =>
            void run(() =>
              onCopy(copyTitle.trim(), { ...config, source: "", sheet: "" }),
            )
          }
        >
          워크스페이스에 사본 저장
        </button>
        <button
          disabled={working || readonly || !copyTitle.trim()}
          onClick={() =>
            void run(() =>
              onCopy(
                copyTitle.trim(),
                { ...config, source: "", sheet: "" },
                true,
              ),
            )
          }
        >
          워크스페이스 템플릿으로 게시
        </button>
        <button
          onClick={() => {
            const data = JSON.stringify(
              { ...config, source: "", sheet: "" },
              null,
              2,
            );
            const url = URL.createObjectURL(
              new Blob([data], { type: "application/json" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "harness.xdocs.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          하네스 파일 내보내기
        </button>
        <button disabled={!config.rules.length || config.rules.length>12} onClick={()=>{
          const harness={name:copyTitle.trim() || "Builder 작업",stages:config.rules.map(rule=>
            [rule.label,rule.instruction,"검토 열: "+(rule.column+1),"기준값: "+rule.threshold,rule.keyword && "검색어: "+rule.keyword].filter(Boolean).join("\n")),
            skills:config.prompt.trim()?[{name:"결과 작성 지침",instruction:config.prompt}]:[]};
          const url=URL.createObjectURL(new Blob([JSON.stringify(harness,null,2)],{type:"application/json"}));
          const a=document.createElement("a");a.href=url;a.download="builder-xcode-harness.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }}>xcode 단계 지침 내보내기</button>
        <button
          disabled={working || readonly}
          onClick={() => fileInput.current?.click()}
        >
          하네스 파일 가져오기
        </button>
        <input
          hidden
          ref={fileInput}
          type="file"
          accept=".json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f)
              void run(async () => {
                if (f.size > 250000)
                  throw Error("하네스 파일은 250 KB 이하만 지원합니다.");
                const c = decodeBuilder(
                  encodeBuilder(JSON.parse(await f.text())),
                );
                if (!c)
                  throw Error("지원하는 Builder 하네스 파일을 선택하세요.");
                onChange({
                  version: 1,
                  rules: c.rules,
                  prompt: c.prompt,
                  input: c.input,
                  source: "",
                  sheet: "",
                });
              });
          }}
        />
      </details>
      <fieldset disabled={readonly || working}>
        <legend>업무 하네스</legend>
        {notes.some((n) => n.body.includes(publishedHarness)) && (
          <label>
            워크스페이스 템플릿
            <select
              aria-label="워크스페이스 템플릿"
              value=""
              onChange={(e) => {
                const item = notes.find((n) => n.id === e.target.value);
                if (!item) return;
                void run(async () => {
                  const full =
                    item.unloaded && api.readNote
                      ? await api.readNote(item.id)
                      : item;
                  const c = decodeBuilder(full.body);
                  if (!c) throw Error("템플릿을 읽을 수 없습니다.");
                  onChange({
                    ...c,
                    source: "",
                    sheet: "",
                    origin: { page: full.id, revision: full.revision },
                  });
                });
              }}
            >
              <option value="">저장된 버전 적용</option>
              {notes
                .filter((n) => n.body.includes(publishedHarness))
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          하네스 템플릿
          <select
            value=""
            onChange={(e) => {
              const next = newBuilder(e.target.value);
              patch({
                rules: next.rules as Rule[],
                prompt: next.prompt,
                input: next.input,
                ...(next.input !== (config.input || "sheet")
                  ? { source: "", sheet: "" }
                  : {}),
              });
            }}
          >
            <option value="">템플릿 적용</option>
            {Object.entries(presets).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {config.input === "note" ? "입력 노트" : "시트 페이지"}
          <select
            aria-label={config.input === "note" ? "입력 노트" : "시트 페이지"}
            value={config.source}
            onChange={(e) => patch({ source: e.target.value, sheet: "" })}
          >
            <option value="">페이지 선택</option>
            {notes
              .filter(
                (n) =>
                  n.id === config.source ||
                  (config.input === "note"
                    ? !/xdocs-(builder|workflow|architecture|sheets)|<!-- xdocs:(?:folder|analyzer) -->/.test(
                        n.body,
                      )
                    : n.body.includes("```xdocs-sheets") || Boolean(n.sheet)),
              )
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
          </select>
        </label>
        {book && config.input !== "note" && (
          <label>
            워크시트
            <select
              value={sheet?.id || ""}
              onChange={(e) => patch({ sheet: e.target.value })}
            >
              {!sheet && <option value="">시트 선택</option>}
              {book.sheets.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {config.rules.map((rule, i) => {
          const fields = (
          <div className="builder-stage" key={i}>
            {i > 0 && (
              <label>
                단계 입력
                <select
                  value={rule.input || "source"}
                  onChange={(e) =>
                    updateRule(i, { input: e.target.value as Rule["input"] })
                  }
                >
                  <option value="source">원본 전체</option>
                  <option value="previous">이전 단계에서 찾은 행</option>
                </select>
              </label>
            )}
            <label>
              <span>
                <input
                  style={{ width: "auto" }}
                  type="checkbox"
                  checked={!!rule.stopOnEmpty}
                  onChange={(e) =>
                    updateRule(i, { stopOnEmpty: e.target.checked })
                  }
                />{" "}
                결과가 없으면 다음 단계 중단
              </span>
            </label>
            <label>
              단계 이름
              <input
                value={rule.label}
                onChange={(e) => updateRule(i, { label: e.target.value })}
              />
            </label>
            <label>
              검토 방식
              <select
                value={rule.kind}
                onChange={(e) =>
                  updateRule(i, { kind: e.target.value as Rule["kind"] })
                }
              >
                {Object.entries(skills).map(([id, s]) => (
                  <option key={id} value={id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              대상 열
              <select
                value={rule.column}
                onChange={(e) =>
                  updateRule(i, { column: Number(e.target.value) })
                }
              >
                {Array.from({ length: columns }, (_, c) => (
                  <option key={c} value={c}>
                    {sheet?.rows[0]?.[c] || c + 1 + "열"}
                  </option>
                ))}
              </select>
            </label>
            {rule.kind === "contains" && (
              <label>
                찾을 문구
                <input
                  value={rule.keyword || ""}
                  onChange={(e) => updateRule(i, { keyword: e.target.value })}
                />
              </label>
            )}
            {rule.kind === "over" && (
              <label>
                초과 기준
                <input
                  type="number"
                  value={rule.threshold}
                  onChange={(e) =>
                    updateRule(i, { threshold: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <label>
              모델 지침
              <input
                value={rule.instruction}
                onChange={(e) => updateRule(i, { instruction: e.target.value })}
              />
            </label>
            <div className="stage-actions">
              <SkillFile
                name={rule.label}
                instruction={rule.instruction}
                onRead={(s) =>
                  updateRule(i, { label: s.name, instruction: s.instruction })
                }
                onError={setError}
              />
              <button
                disabled={!i}
                onClick={() => {
                  const rules = [...config.rules];
                  [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]];
                  patch({ rules });
                }}
              >
                위로
              </button>
              <button disabled={i === config.rules.length - 1} onClick={() => {
                const rules = [...config.rules];
                [rules[i], rules[i + 1]] = [rules[i + 1], rules[i]];
                patch({ rules });
              }}>아래로</button>
              <button
                onClick={() =>
                  patch({
                    rules: [
                      ...config.rules,
                      { ...rule, label: rule.label + " 사본" },
                    ],
                  })
                }
              >
                단계 복제
              </button>
              <button
                onClick={() =>
                  patch({ rules: config.rules.filter((_, j) => i !== j) })
                }
              >
                삭제
              </button>
            </div>
          </div>);
          return config.rules.length < 4 ? fields : <details key={i} open={i===0}>
            <summary>{i+1}. {rule.label}</summary>{fields}</details>;
        })}
        <button
          onClick={() =>
            patch({
              rules: [
                ...config.rules,
                { kind: "empty", column: 0, threshold: 0, ...skills.empty },
              ],
            })
          }
        >
          검토 단계 추가
        </button>
        <details>
          <summary>다른 Builder에서 단계 가져오기</summary>
          <label>원본 Builder
            <select disabled={working || readonly} defaultValue="" onChange={e=>{
              const note=notes.find(n=>n.id===e.target.value);
              setStepSource(null);
              if(note) void run(async()=>{
                const source=note.unloaded && api.readNote ? await api.readNote(note.id) : note;
                const page=decodeBuilder(source.body);
                if(!page) throw Error("Builder 페이지를 선택하세요.");
                setStepSource(page);
              });
            }}>
              <option value="">페이지 선택</option>
              {notes.filter(n=>n.body.includes("```xdocs-builder") || n.unloaded).map(n=><option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </label>
          {stepSource && <label>추가할 단계<select disabled={readonly} value="" onChange={e=>{
            const step=stepSource.rules[Number(e.target.value)];
            if(step) patch({rules:[...config.rules,{...step}]});
          }}><option value="" disabled>단계 선택</option>{stepSource.rules.map((r,i)=><option key={i} value={i}>{i+1}. {r.label}</option>)}</select></label>}
        </details>
        <label>
          프롬프트 방식
          <select
            value=""
            onChange={(e) =>
              patch({ prompt: prompts[e.target.value as keyof typeof prompts] })
            }
          >
            <option value="">방식 선택</option>
            {Object.entries({
              evidence: "근거 인용",
              brief: "업무 메모",
              rubric: "평가표",
              json: "구조화 추출",
              compare: "사례 비교",
              checklist: "체크리스트",
              questions: "명확화 질문",
              actions: "조치 추출",
              triage: "요청 분류",
              translation: "이중 언어 요약",
              timeline: "시간순 정리",
              risks: "위험 검토",
            }).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          프롬프트
          <textarea
            aria-label="프롬프트"
            value={config.prompt}
            onChange={(e) => patch({ prompt: e.target.value })}
          />
        </label>
      </fieldset>
      {result && (
        <>
          <h3>검토 결과 · {result.total}건</h3>
          <details>
            <summary>단계별 실행 결과</summary>
            {result.steps.map((step, i) => (
              <p key={i}>
                {step.label} · 입력 {step.inputs}행 · 검출 {step.matches}행 ·{" "}
                {step.ms.toFixed(1)}ms
              </p>
            ))}
          </details>
          {result.total > 200 && (
            <p>앞의 200건을 표시하고 모델 입력에 사용합니다.</p>
          )}
          <pre>
            {result.findings
              .map(
                (f) =>
                  f.cell + " · " + f.label + " · " + (f.value || "(빈 셀)"),
              )
              .join("\n") || "검토 조건에 맞는 행이 없습니다."}
          </pre>
          {api.builderModel && !readonly && (
            <details>
              <summary>연결한 모델로 초안 작성</summary>
              {api.saveBuilderProfile && (
                <>
                  <label>
                    저장된 모델 프로필
                    <select
                      aria-label="저장된 모델 프로필"
                      value={
                        profiles.some(
                          (p) =>
                            p.name === profile &&
                            p.endpoint === endpoint &&
                            p.model === model,
                        )
                          ? profile
                          : ""
                      }
                      onChange={(e) => {
                        const p = profiles.find(
                          (p) => p.name === e.target.value,
                        );
                        setKey("");
                        setRemember(false);
                        setReply(null);
                        setProfile(p?.name || "");
                        if (p) {
                          setEndpoint(p.endpoint);
                          setModel(p.model);
                        }
                      }}
                    >
                      <option value="">직접 입력</option>
                      {profiles.map((p) => (
                        <option key={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    프로필 이름
                    <input
                      value={profile}
                      onChange={(e) => setProfile(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                Chat Completions 주소
                <input
                  value={endpoint}
                  onChange={(e) => {
                    setEndpoint(e.target.value);
                    setKey("");
                    setReply(null);
                  }}
                />
              </label>
              <label>
                모델 이름
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </label>
              <label>
                API 키
                <input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              </label>
              {api.saveBuilderProfile && (
                <>
                  <label>
                    <span>
                      <input
                        style={{ width: "auto" }}
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />{" "}
                      입력한 키를 OS 키 저장소로 보호
                    </span>
                  </label>
                  <button
                    disabled={working || !profile.trim() || !model.trim()}
                    onClick={() =>
                      void run(async () => {
                        setProfiles(
                          await api.saveBuilderProfile!({
                            name: profile,
                            model,
                            endpoint,
                            key,
                            remember,
                          }),
                        );
                        setProfile(profile.trim());
                        if (remember) setKey("");
                      })
                    }
                  >
                    프로필 저장 · 같은 이름 교체
                  </button>
                </>
              )}
              {api.builderResources && (
                <BuilderContext onText={setContext} disabled={working} />
              )}
              <label>응답 형식
                <select value={config.outputFormat || "text"} onChange={e => patch({outputFormat: e.target.value as Config["outputFormat"]})}>
                  <option value="text">자유 형식</option>
                  <option value="evidence-json">근거 목록 JSON 검증</option>
                </select>
              </label>
              <details>
                <summary>전송할 지침과 셀 보기</summary>
                <pre>{input}</pre>
              </details>
              <button
                disabled={working || !model.trim()}
                onClick={() => void sendModel()}
              >
                {failedInput === input ? "같은 모델로 재시도" : "모델로 전송"}
              </button>
              {failedInput === input && alternatives.length > 0 && (
                <>
                  <label>대체 모델 프로필
                    <select value={fallback?.name ?? ""} onChange={e => setAlternate(e.target.value)}>
                      <option value="">프로필 선택</option>
                      {alternatives.map(p => <option key={p.name}>{p.name}</option>)}
                    </select>
                  </label>
                  {fallback && <p>{fallback.model} · {fallback.endpoint}</p>}
                  <button disabled={working || !fallback} onClick={() => fallback && void sendModel(fallback)}>
                    대체 모델로 전송
                  </button>
                </>
              )}
            </details>
          )}
          {currentReply && (
            <>
              <p>응답 모델 · {reply?.model}</p>
              <pre>{currentReply}</pre>
              {assessment && (
                <div role="status">
                  {assessment.error || (
                    <>
                      <p>근거 검토 · 누락 {assessment.missing?.length}건 · 입력에 없는 주소 {assessment.unknown?.length}건</p>
                      {!!assessment.missing?.length && <p>누락 · {assessment.missing.join(", ")}</p>}
                      {!!assessment.unknown?.length && <p>입력에 없는 주소 · {assessment.unknown.join(", ")}</p>}
                    </>
                  )}
                </div>
              )}
              <button
                onClick={() =>
                  setComparison({ label: reply!.model, input, text: currentReply })
                }
              >
                현재 응답을 비교 기준으로 저장
              </button>
            </>
          )}
          {comparison && (
            <details>
              <summary>모델 응답 비교 · {comparison.label}</summary>
              <p>{comparison.input === input ? "동일 입력" : "입력 변경됨"}</p>
              <pre>{comparison.text}</pre>
              {currentReply && <pre>{currentReply}</pre>}
              <button onClick={() => setComparison(null)}>비교 종료</button>
            </details>
          )}
          <button
            disabled={readonly || working}
            onClick={() =>
              void run(
                async () =>
                  await onSave(
                    [
                      "# 업무 검토 결과",
                      "[[" + source!.id + "|원본 페이지]]",
                      "검출 " +
                        result.total +
                        "건 · 수록 " +
                        result.findings.length +
                        "건",
                      ...result.findings.map(
                        (f) =>
                          "- " +
                          f.cell +
                          " · " +
                          f.label +
                          " · " +
                          (f.value || "(빈 셀)").replace(/[\r\n]+/g, " "),
                      ),
                      currentReply &&
                        currentReply
                          .split(/\r?\n/)
                          .map((l) => "> " + l)
                          .join("\n"),
                    ]
                      .filter(Boolean)
                      .join("\n\n"),
                  ),
              )
            }
          >
            결과를 하위 노트로 저장
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
