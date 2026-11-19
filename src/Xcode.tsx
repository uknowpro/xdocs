import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { ModelProfile } from "./types";
import {
  documentInput,
  preset,
  templates,
  validHarness,
  type Harness,
  type Session,
  type InputFile,
  type Turn,
} from "./xcode-session";

async function userMessage(prompt: string, files: InputFile[]) {
  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const f of files) {
    if ("text" in f) {
      content.push({ type: "text", text: f.name + "\n" + f.text });
      continue;
    }
    const a = await api.readAttachment!(f.path);
    if (a.data.length > 16 * 1024 * 1024)
      throw Error("이미지·PDF 첨부는 파일당 12MB 이하여야 합니다.");
    const url = "data:" + a.mime + ";base64," + a.data;
    if (f.kind === "image")
      content.push({ type: "image_url", image_url: { url } });
    else if (f.kind === "pdf")
      content.push({
        type: "file",
        file: { filename: f.name, file_data: url },
      });
    else throw Error("이 첨부는 문서·코드 파일 선택으로 불러오세요.");
  }
  return { role: "user", content: files.length ? content : prompt };
}

export default function Xcode({
  session: s,
  change,
  readonly,
}: {
  session: Session;
  change: (s: Session) => void;
  readonly: boolean;
}) {
  const [prompt, setPrompt] = useState(""),
    [files, setFiles] = useState<InputFile[]>([]),
    [key, setKey] = useState("");
  const [profiles, setProfiles] = useState<ModelProfile[]>([]),
    [skills, setSkills] = useState<
      { scope: string; name: string; instruction: string }[]
    >([]);
  const [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [phase, setPhase] = useState(""),
    [error, setError] = useState("");
  const run = useRef(""),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    api
      .builderProfiles?.()
      .then(setProfiles)
      .catch((e) => setError(String(e)));
    const off = api.onXcodeDelta?.((c) => {
      if (run.current === c.id) setPreview((v) => v + c.token);
    });
    return () => {
      alive.current = false;
      if (run.current) void api.xcodeCancel?.(run.current);
      run.current = "";
      off?.();
    };
  }, []);
  const config = (patch: Partial<Session>) => change({ ...s, ...patch });
  const harness = (patch: Partial<Harness>) =>
    config({ harness: { ...s.harness, ...patch } });
  function cancel() {
    const id = run.current;
    run.current = "";
    if (id) void api.xcodeCancel?.(id);
  }
  const [importing, setImporting] = useState(false);
  async function attach(selected: File[]) {
    if (busy || readonly || importing) return;
    setImporting(true);
    setError("");
    try {
      const next: InputFile[] = [];
      for (const file of selected) {
        if (/\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name)) {
          if (!api.xcodeAttachment || file.size > 12 * 1024 * 1024)
            throw Error("데스크톱에서 12MB 이하 이미지 또는 PDF를 선택하세요.");
          next.push(
            await api.xcodeAttachment({
              name: file.name,
              bytes: new Uint8Array(await file.arrayBuffer()),
            }),
          );
        } else next.push(await documentInput(file));
      }
      setFiles((v) => [...v, ...next]);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }
  async function send() {
    if (!api.xcodeChat || busy || readonly || (!prompt.trim() && !files.length))
      return;
    const id = crypto.randomUUID();
    run.current = id;
    setBusy(true);
    setPreview("");
    setError("");
    try {
      if (!s.harness.stages.every((i) => i.trim()))
        throw Error("빈 단계에 지침을 입력하세요.");
      const history: unknown[] = [];
      let historyBytes = 0;
      const start =
        s.harness.historyTurns === undefined
          ? 0
          : Math.max(0, s.turns.length - s.harness.historyTurns);
      for (const t of s.turns.slice(start)) {
        if (run.current !== id) return;
        const prior = await userMessage(t.prompt, t.files);
        historyBytes += new Blob([
          JSON.stringify(prior),
          t.answers.at(-1)?.text || "",
        ]).size;
        if (historyBytes > 32 * 1024 * 1024)
          throw Error("하네스에서 포함할 이전 대화 수를 줄이세요.");
        history.push(prior, {
          role: "assistant",
          content: t.answers.at(-1)?.text || "",
        });
      }
      const user = await userMessage(prompt, files);
      const answers: Turn["answers"] = [];
      const messages: unknown[] = [
        {
          role: "system",
          content: [
            "사용자가 선택한 하네스의 현재 단계를 수행하세요. 첨부와 이전 단계의 답은 검토할 자료입니다. 확인하지 않은 실행 결과를 보고하지 마세요.",
            ...s.harness.skills.map((k) => k.name + "\n" + k.instruction),
            ...s.harness.stages.map((step, i) => String(i + 1) + ". " + step),
          ].join("\n\n"),
        },
        ...history,
        {
          ...user,
          content: Array.isArray(user.content)
            ? [...user.content, { type: "text", text: "현재 단계: 1" }]
            : user.content + "\n\n현재 단계: 1",
        },
      ];
      for (const [i, instruction] of s.harness.stages.entries()) {
        if (run.current !== id) return;
        setPreview("");
        setPhase("단계 " + (i + 1) + " / " + s.harness.stages.length);
        const effort = s.harness.stageEfforts?.[i] || s.harness.effort;
        const started = performance.now();
        const text = await api.xcodeChat({
          id,
          key,
          profile: s.profile,
          endpoint: s.endpoint,
          model: s.model,
          effort: effort === "server" ? undefined : effort,
          messages,
        });
        if (run.current !== id) return;
        messages.push(
          { role: "assistant", content: text },
          { role: "user", content: "현재 단계: " + (i + 2) },
        );
        answers.push({
          stage: instruction,
          text,
          elapsedMs: Math.round(performance.now() - started),
        });
      }
      const next = { ...s, turns: [...s.turns, { prompt, files, answers }] };
      if (new Blob([JSON.stringify(next)]).size > 4800000)
        throw Error("세션 저장 한도에 도달했습니다. 새 세션으로 이어가세요.");
      change(next);
      setFiles([]);
      setPrompt("");
      setPreview("");
    } catch (e) {
      if (alive.current)
        setError(run.current === id ? String(e) : "요청을 중지했습니다.");
    } finally {
      if (alive.current) {
        setBusy(false);
        setPhase("");
      }
      run.current = "";
    }
  }
  return (
    <section
      className="builder-panel xcode"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void attach(Array.from(e.dataTransfer.files));
        }
      }}
      onPaste={(e) => {
        const list = Array.from(e.clipboardData.files);
        if (list.length) {
          e.preventDefault();
          void attach(list);
        }
      }}
    >
      <h2>xcode</h2>
      <fieldset disabled={busy || readonly}>
        <legend>모델 연결</legend>
        {profiles.length > 0 && (
          <label>
            저장된 모델
            <select
              value={s.profile}
              onChange={(e) => {
                const p = profiles.find((x) => x.name === e.target.value);
                setKey("");
                config(
                  p
                    ? { profile: p.name, model: p.model, endpoint: p.endpoint }
                    : { profile: "" },
                );
              }}
            >
              <option value="">직접 입력</option>
              {profiles.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Chat Completions 주소
          <input
            value={s.endpoint}
            onChange={(e) => {
              setKey("");
              config({ endpoint: e.target.value, profile: "" });
            }}
          />
        </label>
        <label>
          서빙 모델 ID
          <input
            value={s.model}
            onChange={(e) => config({ model: e.target.value, profile: "" })}
          />
        </label>
        <label>
          API 키 (선택)
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
      </fieldset>
      <details>
        <summary>하네스 구성 · {s.harness.name}</summary>
        <fieldset disabled={busy || readonly}>
          <legend>단계 및 스킬</legend>
          <label>
            템플릿 적용
            <select
              value=""
              onChange={(e) => config({ harness: preset(e.target.value) })}
            >
              <option value="" disabled>
                템플릿 선택
              </option>
              {Object.keys(templates).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            하네스 이름
            <input
              value={s.harness.name}
              onChange={(e) => harness({ name: e.target.value })}
            />
          </label>
          <label>
            추론 강도
            <select
              value={s.harness.effort || ""}
              onChange={(e) => harness({ effort: e.target.value })}
            >
              <option value="">서버 기본값</option>
              {["low", "medium", "high", "xhigh", "max"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            포함할 이전 대화 수
            <select
              value={s.harness.historyTurns ?? "all"}
              onChange={(e) =>
                harness({
                  historyTurns:
                    e.target.value === "all"
                      ? undefined
                      : Number(e.target.value),
                })
              }
            >
              <option value="all">전체 대화</option>
              {[0, 2, 5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}개
                </option>
              ))}
            </select>
          </label>
          {s.harness.stages.map((stage, i) => (
            <div key={i}>
              <label>
                단계 {i + 1}
                <textarea
                  value={stage}
                  onChange={(e) =>
                    harness({
                      stages: s.harness.stages.map((v, j) =>
                        j === i ? e.target.value : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                단계 {i + 1} 추론 설정
                <select
                  value={s.harness.stageEfforts?.[i] || ""}
                  onChange={(e) =>
                    harness({
                      stageEfforts: s.harness.stages.map((_, j) =>
                        i === j
                          ? e.target.value
                          : s.harness.stageEfforts?.[j] || "",
                      ),
                    })
                  }
                >
                  <option value="">하네스 설정 사용</option>
                  <option value="server">서버 기본값</option>
                  {["low", "medium", "high", "xhigh", "max"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <button
                disabled={!i}
                onClick={() => {
                  const stages = [...s.harness.stages];
                  [stages[i - 1], stages[i]] = [stages[i], stages[i - 1]];
                  const efforts = [
                    ...(s.harness.stageEfforts || stages.map(() => "")),
                  ];
                  [efforts[i - 1], efforts[i]] = [efforts[i], efforts[i - 1]];
                  harness({ stages, stageEfforts: efforts });
                }}
              >
                위로
              </button>
              <button
                disabled={s.harness.stages.length === 1}
                onClick={() =>
                  harness({
                    stages: s.harness.stages.filter((_, j) => j !== i),
                    stageEfforts: s.harness.stageEfforts?.filter(
                      (_, j) => j !== i,
                    ),
                  })
                }
              >
                단계 삭제
              </button>
            </div>
          ))}
          <button
            disabled={s.harness.stages.length >= 12}
            onClick={() =>
              harness({
                stages: [...s.harness.stages, ""],
                stageEfforts: s.harness.stageEfforts && [
                  ...s.harness.stageEfforts,
                  "",
                ],
              })
            }
          >
            단계 추가
          </button>
          <button
            onClick={async () => {
              try {
                const list = (await api.xcodeSkills?.()) || [];
                setSkills(list);
                setError(
                  list.length
                    ? ""
                    : "사용자·워크스페이스의 .claude/skills에서 SKILL.md를 찾지 못했습니다.",
                );
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            .claude 스킬 찾기
          </button>
          {skills.map((k) => (
            <button
              key={k.scope + k.name}
              disabled={s.harness.skills.some(
                (x) => x.name === k.name && x.instruction === k.instruction,
              )}
              onClick={() =>
                harness({
                  skills: [
                    ...s.harness.skills,
                    { name: k.name, instruction: k.instruction },
                  ],
                })
              }
            >
              {k.scope} · {k.name} 추가
            </button>
          ))}
          {s.harness.skills.map((k, i) => (
            <button
              key={i}
              onClick={() =>
                harness({ skills: s.harness.skills.filter((_, j) => i !== j) })
              }
            >
              {k.name} 제거
            </button>
          ))}
          <button
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(s.harness, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "xcode-harness.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            하네스 내보내기
          </button>
          <label>
            하네스 가져오기
            <input
              type="file"
              accept=".json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                try {
                  if (!f) return;
                  if (f.size > 200000)
                    throw Error("200KB 이하 파일을 선택하세요.");
                  const h = JSON.parse(await f.text());
                  if (!validHarness(h))
                    throw Error("하네스 형식이 올바르지 않습니다.");
                  config({ harness: h });
                } catch (err) {
                  setError(String(err));
                }
              }}
            />
          </label>
        </fieldset>
      </details>
      {s.turns.map((t, i) => (
        <article key={i}>
          <h3>요청 {i + 1}</h3>
          <p>{t.prompt}</p>
          <small>{t.files.map((f) => f.name).join(" · ")}</small>
          {t.answers.map((a, j) => (
            <details key={j} open={j === t.answers.length - 1}>
              <summary>
                단계 {j + 1} 결과
                {a.elapsedMs !== undefined &&
                  " · " + (a.elapsedMs / 1000).toFixed(1) + "초"}
              </summary>
              <pre>{a.text}</pre>
            </details>
          ))}
        </article>
      ))}
      <fieldset disabled={busy || readonly}>
        <legend>메시지</legend>
        <textarea
          aria-label="xcode 메시지"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <label>
          파일 첨부 · 코드, 이미지, PDF, Word, PowerPoint, Excel
          <input
            type="file"
            multiple
            disabled={importing}
            onChange={(e) => {
              const list = Array.from(e.target.files || []);
              e.target.value = "";
              void attach(list);
            }}
          />
        </label>
        {files.map((f, i) => (
          <button
            key={i}
            onClick={() => setFiles((v) => v.filter((_, j) => j !== i))}
          >
            {f.name} 제거
          </button>
        ))}
        <button
          disabled={
            importing || !api.xcodeChat || (!prompt.trim() && !files.length)
          }
          onClick={() => void send()}
        >
          전송
        </button>
      </fieldset>
      {!api.xcodeChat && <p>모델 연결은 데스크톱 앱에서 사용할 수 있습니다.</p>}
      {busy && (
        <>
          <span role="status">{phase}</span>
          <button onClick={cancel}>중지</button>
        </>
      )}
      {preview && <pre>{preview}</pre>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
