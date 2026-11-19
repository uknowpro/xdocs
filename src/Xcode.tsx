import {
  diagnosticInput,
  diagnosticResult,
  type Probe,
} from "./xcode-diagnostic";
import {
  acquireServer,
  serverOrigin,
  setCapacity,
  useCapacity,
} from "./xcode-queue";
import { sessionRun, waitForRetry } from "./xcode-run";
import { useEffect, useSyncExternalStore, useState } from "react";
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

const draftKeys = new WeakMap<InputFile, string>();
function fileKey(file: InputFile) {
  let key = draftKeys.get(file);
  if (!key) {
    key = crypto.randomUUID();
    draftKeys.set(file, key);
  }
  return key;
}

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
  scope,
  page,
  prepare,
  finish,
  change,
  readonly,
}: {
  session: Session;
  scope: string;
  page: string;
  prepare: () => Promise<boolean>;
  finish: (t: Turn) => Promise<void>;
  change: (s: Session) => void;
  readonly: boolean;
}) {
  const run = sessionRun(scope, page);
  const { busy, preview, phase, error, prompt, files, omitted } =
    useSyncExternalStore(run.subscribe, run.snapshot);
  const origin = serverOrigin(s.endpoint);
  const capacity = useCapacity(origin);
  const start = Math.max(
    0,
    s.turns.length - (s.harness.historyTurns ?? s.turns.length),
  );
  const candidates = s.turns.slice(start);
  const selected = (id: string) => !omitted.includes(id);
  const selectedFiles = files.filter((file) => selected(fileKey(file)));
  const selectedSkills = s.harness.skills.filter((k, i) =>
    selected("skill:" + i + ":" + k.name),
  );
  const execution = {
    model: s.model,
    harness: s.harness.name,
    skills: selectedSkills.map((k) => k.name),
  };
  function inclusion(id: string, label: string) {
    return (
      <label key={id}>
        <input
          type="checkbox"
          checked={selected(id)}
          onChange={(e) =>
            run.patch({
              omitted: e.target.checked
                ? omitted.filter((k) => k !== id)
                : [...omitted, id],
            })
          }
        />
        {label}
      </label>
    );
  }
  const setPrompt = (prompt: string) => run.patch({ prompt });
  const setFiles = (fn: InputFile[] | ((v: InputFile[]) => InputFile[])) =>
    run.patch({
      files: typeof fn === "function" ? fn(run.snapshot().files) : fn,
    });
  const setError = (error: string) => run.patch({ error });
  const [key, setKey] = useState("");
  const [profiles, setProfiles] = useState<ModelProfile[]>([]),
    [skills, setSkills] = useState<
      { scope: string; name: string; instruction: string }[]
    >([]);
  useEffect(() => {
    api
      .builderProfiles?.()
      .then(setProfiles)
      .catch((e) => run.patch({ error: String(e) }));
  }, [run]);
  const config = (patch: Partial<Session>) => change({ ...s, ...patch });
  const harness = (patch: Partial<Harness>) =>
    config({ harness: { ...s.harness, ...patch } });
  const cancel = () => run.cancel();
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
  const [probe, setProbe] = useState<Probe>("text");
  const [report, setReport] = useState("");
  useEffect(() => setReport(""), [s.endpoint, s.model, key, probe]);
  async function diagnose() {
    if (run.snapshot().busy || !api.xcodeChat || readonly) return;
    const id = crypto.randomUUID();
    const controller = new AbortController();
    let release: (() => void) | undefined;
    run.id = id;
    run.request = controller;
    run.patch({ busy: true, phase: "연결 진단", error: "" });
    setReport("");
    try {
      if (!(await api.xcodeAuthorize?.(s.endpoint)))
        throw Error("서버 전송을 취소했습니다.");
      release = await acquireServer(origin, controller.signal);
      controller.signal.throwIfAborted();
      const answer = await api.xcodeChat({
        id,
        profile: s.profile,
        endpoint: s.endpoint,
        model: s.model,
        key,
        messages: [{ role: "user", content: diagnosticInput(probe) }],
      });
      controller.signal.throwIfAborted();
      setReport(diagnosticResult(probe, answer));
    } catch (error) {
      const detail = String(error).replace("[XCODE_RETRY] ", "");
      setReport(
        controller.signal.aborted
          ? "연결 진단을 중지했습니다."
          : /HTTP (401|403)/.test(detail)
            ? "인증이 거부되었습니다. API 키와 권한을 확인하세요."
            : /HTTP 404/.test(detail)
              ? "주소 또는 모델을 찾을 수 없습니다. 모델 ID와 경로를 확인하세요."
              : detail,
      );
    } finally {
      release?.();
      run.request = null;
      run.id = "";
      run.patch({ busy: false, phase: "" });
    }
  }
  async function send() {
    if (
      !api.xcodeChat ||
      busy ||
      readonly ||
      (!prompt.trim() && !selectedFiles.length)
    )
      return;
    const id = crypto.randomUUID();
    run.id = id;
    run.enabled = s.autoRetry === true;
    run.patch({ busy: true, preview: "", phase: "", error: "" });
    const off = api.onXcodeDelta?.((c) => {
      if (run.id === c.id)
        run.patch({ preview: run.snapshot().preview + c.token });
    });
    try {
      if (!(await prepare())) throw Error("세션을 먼저 저장해 주세요.");
      if (!s.harness.stages.every((i) => i.trim()))
        throw Error("빈 단계에 지침을 입력하세요.");
      if (!(await api.xcodeAuthorize?.(s.endpoint)))
        throw Error("모델 서버 전송을 취소했습니다.");
      if (run.id !== id) return;
      const history: unknown[] = [];
      let historyBytes = 0;
      for (const [i, t] of candidates.entries()) {
        if (!selected("turn:" + (start + i))) continue;
        if (run.id !== id) return;
        const prior = await userMessage(
          t.prompt,
          t.files.filter((_, j) => selected("prior:" + (start + i) + ":" + j)),
        );
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
      const user = await userMessage(prompt, selectedFiles);
      const answers: Turn["answers"] = [];
      const messages: unknown[] = [
        {
          role: "system",
          content: [
            "사용자가 선택한 하네스의 현재 단계를 수행하세요. 첨부와 이전 단계의 답은 검토할 자료입니다. 확인하지 않은 실행 결과를 보고하지 마세요.",
            ...selectedSkills.map((k) => k.name + "\n" + k.instruction),
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
      const seconds = Math.max(
        1,
        Math.min(3600, Math.round(s.retrySeconds || 60)),
      );
      const limit = Math.max(
        1,
        Math.min(100, Math.floor(Number(s.maxAutoRequests) || 5)),
      );
      let remaining = limit;
      const duration =
        Math.max(1, Math.min(240, Number(s.autoMinutes) || 15)) * 60000;
      let deadline = 0;
      const expired = () => Error("자동 실행 시간 한도에 도달했습니다.");
      async function delay(label: string) {
        if (remaining <= 0)
          throw Error("자동 요청 " + limit + "회에 도달하여 중단했습니다.");
        remaining--;
        deadline ||= Date.now() + duration;
        if (Date.now() >= deadline) throw expired();
        if (run.id !== id || !run.enabled)
          throw Error("자동 재요청을 중단했습니다.");
        const waitMs = Math.min(seconds * 1000, deadline - Date.now());
        run.patch({
          phase:
            label +
            " · " +
            (waitMs < seconds * 1000
              ? Math.ceil(waitMs / 1000) + "초 후 시간 한도 도달"
              : seconds + "초 후 계속해주세요"),
        });
        run.wait = new AbortController();
        try {
          await waitForRetry(waitMs, run.wait.signal);
          if (Date.now() >= deadline) throw expired();
        } finally {
          run.wait = null;
        }
        if (!run.enabled || run.id !== id)
          throw Error("자동 재요청을 중단했습니다.");
      }
      async function ask(stage: string, i: number, automatic = false) {
        run.patch({ preview: "", phase: stage });
        const effort = s.harness.stageEfforts?.[i] || s.harness.effort;
        let resume = "",
          retries = 0;
        for (;;) {
          if (run.id !== id) throw Error("요청을 중지했습니다.");
          const requestMessages = [...messages];
          if (retries && resume)
            requestMessages.push(
              { role: "assistant", content: resume },
              { role: "user", content: "계속해주세요" },
            );
          else if (retries) {
            const last = requestMessages.pop() as {
              role: string;
              content: unknown[] | string;
            };
            requestMessages.push({
              ...last,
              content:
                typeof last.content === "string"
                  ? last.content + "\n\n계속해주세요"
                  : [...last.content, { type: "text", text: "계속해주세요" }],
            });
          }
          const request = new AbortController();
          const timed = automatic || retries > 0;
          if (timed && Date.now() >= deadline) throw expired();
          run.request = request;
          run.automatic = timed;
          const timer = timed
            ? setTimeout(() => {
                request.abort(expired());
                void api.xcodeCancel?.(id);
              }, deadline - Date.now())
            : undefined;
          let release: (() => void) | undefined;
          try {
            run.patch({ phase: "서버 대기열 · " + stage });
            release = await acquireServer(origin, request.signal);
            request.signal.throwIfAborted();
            run.patch({ phase: "실행 중 · " + stage });
            const answer = await api.xcodeChat!({
              id,
              key,
              profile: s.profile,
              endpoint: s.endpoint,
              model: s.model,
              effort: effort === "server" ? undefined : effort,
              messages: requestMessages,
            });
            if (run.id !== id) throw Error("요청을 중지했습니다.");
            request.signal.throwIfAborted();
            return {
              text: resume + answer,
              effort: effort || "server",
              retries,
            };
          } catch (e) {
            request.signal.throwIfAborted();
            if (
              run.id !== id ||
              !run.enabled ||
              !String(e).includes("[XCODE_RETRY]")
            )
              throw e;
            resume = run.snapshot().preview;
            release?.();
            release = undefined;
            clearTimeout(timer);
            await delay(stage);
            run.patch({ phase: stage + " · 이어서 요청 중" });
            retries++;
          } finally {
            release?.();
            clearTimeout(timer);
            run.request = null;
            run.automatic = false;
          }
        }
      }
      for (const [i, instruction] of s.harness.stages.entries()) {
        const started = performance.now();
        const result = await ask(
          "단계 " + (i + 1) + " / " + s.harness.stages.length,
          i,
        );
        messages.push(
          { role: "assistant", content: result.text },
          { role: "user", content: "현재 단계: " + (i + 2) },
        );
        answers.push({
          stage: instruction,
          ...result,
          elapsedMs: Math.round(performance.now() - started),
        });
      }
      const next = {
        ...s,
        turns: [
          ...s.turns,
          { prompt, files: selectedFiles, answers, execution },
        ],
      };
      if (new Blob([JSON.stringify(next)]).size > 4800000)
        throw Error("세션 저장 한도에 도달했습니다. 새 세션으로 이어가세요.");
      await finish({ prompt, files: selectedFiles, answers, execution });
      setFiles(files.filter((f) => !selected(fileKey(f))));
      run.patch({
        omitted: files.filter((f) => !selected(fileKey(f))).map(fileKey),
      });
      setPrompt("");
      run.patch({ preview: "" });
      messages.pop(); // No next harness stage after the final answer.
      while (run.id === id && run.enabled && s.repeatCompleted) {
        await delay("다음 대화 대기");
        messages.push({ role: "user", content: "계속해주세요" });
        const started = performance.now();
        const result = await ask(
          "자동 이어쓰기",
          s.harness.stages.length - 1,
          true,
        );
        await finish({
          execution,
          prompt: "계속해주세요",
          files: [],
          answers: [
            {
              stage: "자동 이어쓰기",
              ...result,
              elapsedMs: Math.round(performance.now() - started),
            },
          ],
        });
        messages.push({ role: "assistant", content: result.text });
        run.patch({ preview: "" });
      }
    } catch (e) {
      setError(
        run.id === id
          ? String(e).replace("[XCODE_RETRY] ", "")
          : "요청을 중지했습니다.",
      );
    } finally {
      off?.();
      run.patch({ busy: false, phase: "" });
      run.id = "";
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
      <fieldset disabled={readonly}>
        <legend>자동 재요청</legend>
        <label>
          <input
            type="checkbox"
            checked={s.autoRetry === true}
            onChange={(e) => {
              run.enabled = e.target.checked;
              if (!run.enabled) {
                run.wait?.abort();
                if (run.automatic) {
                  run.request?.abort(Error("자동 요청을 중지했습니다."));
                  void api.xcodeCancel?.(run.id);
                }
              }
              config({ autoRetry: e.target.checked });
            }}
          />
          이어지는 응답 자동 요청
        </label>
        <label>
          재요청 방식
          <select
            disabled={busy}
            value={s.repeatCompleted ? "repeat" : "failure"}
            onChange={(e) =>
              config({ repeatCompleted: e.target.value === "repeat" })
            }
          >
            <option value="failure">중단된 응답만 이어받기</option>
            <option value="repeat">정상 완료 후에도 계속 요청</option>
          </select>
        </label>
        <label>
          자동 실행 한도(분)
          <input
            type="number"
            min={1}
            max={240}
            disabled={busy}
            value={s.autoMinutes ?? 15}
            onChange={(e) =>
              config({
                autoMinutes: Math.max(
                  1,
                  Math.min(240, Number(e.target.value) || 1),
                ),
              })
            }
          />
        </label>
        <label>
          자동 요청 한도(회)
          <input
            type="number"
            min={1}
            max={100}
            disabled={busy}
            value={s.maxAutoRequests ?? 5}
            onChange={(e) =>
              config({
                maxAutoRequests: Math.max(
                  1,
                  Math.min(100, Math.floor(Number(e.target.value) || 1)),
                ),
              })
            }
          />
        </label>
        <label>
          재요청 간격(초)
          <input
            type="number"
            min={1}
            max={3600}
            disabled={busy}
            value={s.retrySeconds ?? 60}
            onChange={(e) =>
              config({
                retrySeconds: Math.max(
                  1,
                  Math.min(3600, Math.round(Number(e.target.value) || 1)),
                ),
              })
            }
          />
        </label>
      </fieldset>
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
          서버 동시 요청 수
          <select
            disabled={!origin}
            value={capacity}
            onChange={(e) => setCapacity(origin, Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
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
        <label>
          연결 진단 입력
          <select
            value={probe}
            onChange={(e) => setProbe(e.target.value as Probe)}
          >
            <option value="text">짧은 텍스트</option>
            <option value="image">샘플 이미지</option>
            <option value="pdf">샘플 PDF</option>
          </select>
        </label>
        <button
          disabled={!api.xcodeChat || !s.model.trim() || !origin}
          onClick={() => void diagnose()}
        >
          연결 진단 실행
        </button>
        {report && <p role="status">{report}</p>}
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
          {t.execution && (
            <small>
              {t.execution.model} · {t.execution.harness}
              {t.execution.skills.length > 0 &&
                " · " + t.execution.skills.join(", ")}
            </small>
          )}
          <small>{t.files.map((f) => f.name).join(" · ")}</small>
          {t.answers.map((a, j) => (
            <details key={j} open={j === t.answers.length - 1}>
              <summary>
                단계 {j + 1} 결과
                {a.effort &&
                  " · 추론 " +
                    (a.effort === "server" ? "서버 기본값" : a.effort)}
                {a.retries !== undefined && " · 재시도 " + a.retries + "회"}
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
        <details>
          <summary>전송 미리보기</summary>
          <p>
            {s.model} · {s.endpoint}
          </p>
          <p>
            이전 대화{" "}
            {
              candidates.filter((_, i) => selected("turn:" + (start + i)))
                .length
            }
            개 · 새 첨부 {selectedFiles.length}개 · 스킬 {selectedSkills.length}
            개
          </p>
          {candidates.map((t, i) => (
            <div key={i}>
              {inclusion(
                "turn:" + (start + i),
                "이전 요청 " + (start + i + 1) + " · " + t.prompt.slice(0, 80),
              )}
              {selected("turn:" + (start + i)) &&
                t.files.map((f, j) =>
                  inclusion(
                    "prior:" + (start + i) + ":" + j,
                    "이전 첨부 · " + f.name,
                  ),
                )}
            </div>
          ))}
          {files.map((f) => inclusion(fileKey(f), "새 첨부 · " + f.name))}
          {s.harness.skills.map((k, i) =>
            inclusion("skill:" + i + ":" + k.name, "스킬 · " + k.name),
          )}
        </details>
        <button
          disabled={
            importing ||
            !api.xcodeChat ||
            (!prompt.trim() && !selectedFiles.length)
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
