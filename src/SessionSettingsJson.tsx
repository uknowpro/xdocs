import { useRef, useState } from "react";
import type { Session } from "./xcode-session";
import { chatCompletionsEndpoint, isRemoteHttpEndpoint, sameChatEndpoint } from "../desktop/builder-model.mjs";

type Settings = Pick<
  Session,
  | "endpoint"
  | "model"
  | "intranetHttpEndpoint"
  | "autoRetry"
  | "repeatCompleted"
  | "retrySeconds"
  | "maxAutoRequests"
  | "autoMinutes"
>;
const ranges = {
  retrySeconds: [1, 3600],
  maxAutoRequests: [1, 100],
  autoMinutes: [1, 240],
} as const;
const flags = ["autoRetry", "repeatCompleted"] as const;
const allowed = new Set([
  "endpoint",
  "model",
  "token",
  "allowIntranetHttp",
  ...flags,
  ...Object.keys(ranges),
]);
const maxLength = 32 * 1024;

function parseSettings(text: string) {
  if (text.length > maxLength)
    throw Error("32KB 이하의 설정 파일을 사용하세요.");
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    const offset = /position (\d+)/.exec(String(cause));
    throw Object.assign(Error(
      "JSON 문법을 확인하세요. 키와 문자열은 큰따옴표로 묶어야 합니다.",
    ), {offset:offset ? Number(offset[1]) : text.length});
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("설정을 JSON 객체로 입력하세요.");
  for (const field of Object.keys(value))
    if (!allowed.has(field)) throw Error("지원하지 않는 항목: " + field);
  let endpoint;
  try {
    if (typeof value.endpoint !== "string" || !value.endpoint.trim())
      throw Error();
    endpoint = chatCompletionsEndpoint(value.endpoint.trim());
  } catch {
    throw Error(
      "endpoint에 HTTP 또는 HTTPS API 주소(/v1 기본 주소 또는 Chat Completions 전체 주소)를 입력하세요.",
    );
  }
  if (typeof value.model !== "string" || !value.model.trim())
    throw Error("model에 서버가 제공하는 모델명을 입력하세요.");
  if (value.token !== undefined && typeof value.token !== "string")
    throw Error("token은 문자열이어야 합니다.");
  if (value.allowIntranetHttp !== undefined && typeof value.allowIntranetHttp !== "boolean")
    throw Error("allowIntranetHttp에는 true 또는 false를 입력하세요.");
  if (isRemoteHttpEndpoint(endpoint) && value.allowIntranetHttp !== true)
    throw Error("allowIntranetHttp에 true를 입력해 이 사내 HTTP 주소를 허용하세요.");
  const settings: Settings = {
    endpoint: value.endpoint.trim(),
    model: value.model.trim(),
    intranetHttpEndpoint: isRemoteHttpEndpoint(endpoint) ? endpoint.href : undefined,
  };
  for (const field of flags) {
    if (!(field in value)) continue;
    if (typeof value[field] !== "boolean")
      throw Error(field + "에는 true 또는 false를 입력하세요.");
    settings[field] = value[field];
  }
  for (const field of Object.keys(ranges) as (keyof typeof ranges)[]) {
    if (!(field in value)) continue;
    const [min, max] = ranges[field];
    if (
      !Number.isInteger(value[field]) ||
      value[field] < min ||
      value[field] > max
    )
      throw Error(
        field + "에는 " + min + "에서 " + max + " 사이의 정수를 입력하세요.",
      );
    settings[field] = value[field];
  }
  return { settings, token: value.token as string | undefined };
}

export default function SessionSettingsJson({
  session,
  disabled,
  apply,
}: {
  session: Session;
  disabled: boolean;
  apply: (settings: Settings, token?: string) => void;
}) {
  const {
    endpoint,
    model,
    autoRetry = false,
    repeatCompleted = false,
    retrySeconds = 60,
    maxAutoRequests = 5,
    autoMinutes = 15,
  } = session;
  const current = JSON.stringify(
    {
      endpoint,
      model,
      ...(session.intranetHttpEndpoint && sameChatEndpoint(endpoint, session.intranetHttpEndpoint)
        ? { allowIntranetHttp: true }
        : {}),
      autoRetry,
      repeatCompleted,
      retrySeconds,
      maxAutoRequests,
      autoMinutes,
    },
    null,
    2,
  );
  const input = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseSettings>>();
  const changes = preview && (Object.entries(preview.settings) as [keyof Settings, Settings[keyof Settings]][])
    .filter(([field, value]) => value !== ({ ...session, autoRetry, repeatCompleted, retrySeconds, maxAutoRequests, autoMinutes })[field]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  function edit(text: string) {
    setDraft(text);
    setPreview(undefined);
    setError("");
    setNotice("");
  }
  function saveFile() {
    const url = URL.createObjectURL(
      new Blob([current + "\n"], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "settings.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="chat-json" aria-label="JSON 설정">
      <fieldset disabled={disabled}>
        <legend>settings.json</legend>
        <label>
          설정 JSON
          <textarea ref={input} aria-invalid={!!error} aria-label="설정 JSON"
            value={draft ?? current}
            spellCheck={false}
            autoCapitalize="off"
            rows={9}
            onChange={(e) => edit(e.target.value)}
          />
        </label>
        <label>
          설정 파일 불러오기
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setPreview(undefined);
              setNotice("");
              try {
                if (file.size > maxLength)
                  throw Error("32KB 이하의 설정 파일을 사용하세요.");
                edit(await file.text());
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "파일을 읽을 수 없습니다.",
                );
                setNotice("");
              }
            }}
          />
        </label>
        <div>
          <button
            onClick={() => {
              try {
                setPreview(parseSettings(draft ?? current));
                setError("");
                setNotice("");
              } catch (err) {
                const field=err instanceof Error && [...allowed].find(k=>err.message.startsWith(k+"에") || err.message.startsWith(k+"은") || err.message.startsWith(k+"는"));
                const unknown = err instanceof Error && /^지원하지 않는 항목: (.+)$/.exec(err.message)?.[1];
                const key=field || unknown;
                const el=input.current;
                if (el) {
                  const index=err && typeof err==="object" && "offset" in err && typeof err.offset==="number" ? err.offset : key ? Math.max(0,el.value.indexOf(JSON.stringify(key))) : 0;
                  el.focus();el.setSelectionRange(index,index+(key ? JSON.stringify(key).length : 1));
                }
                setPreview(undefined);
                setNotice("");
                setError(
                  err instanceof Error ? err.message : "입력을 확인하세요.",
                );
              }
            }}
          >
            변경 사항 보기
          </button>
          <button onClick={() => edit(current)}>현재 설정 불러오기</button>
          <button onClick={saveFile}>현재 설정 내보내기</button>
        </div>
        {preview && <section className="json-changes" aria-label="JSON 변경 미리보기">
          <h3>변경 사항</h3>
          {(!changes?.length && preview.token === undefined) ? <p>변경되는 값이 없습니다.</p> : <>
            <dl>
              {changes?.map(([field, value]) => <div key={field}>
                <dt>{field === "intranetHttpEndpoint" ? "allowIntranetHttp" : field}</dt>
                <dd>{field === "intranetHttpEndpoint" ? value ? "허용" : "해제" : String(value)}</dd>
              </div>)}
              {preview.token !== undefined && <div><dt>token</dt><dd>{preview.token ? "••••••••" : "비우기"}</dd></div>}
            </dl>
            <button type="button" onClick={() => {
              apply(preview.settings, preview.token);
              setPreview(undefined);
              setDraft(null);
              setNotice("편집 중인 설정에 반영했습니다. 설정 저장을 눌러 완료하세요.");
            }}>JSON 적용</button>
          </>}
        </section>}
        <small>내보낸 설정 파일에서 토큰은 제외됩니다.</small>
        {error && <p role="alert">{error}</p>}
        {notice && <p aria-live="polite">{notice}</p>}
      </fieldset>
    </section>
  );
}
