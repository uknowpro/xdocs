import { useRef, useState } from "react";
import type { Session } from "./xcode-session";
import { builderEndpoint } from "../desktop/builder-model.mjs";

type Settings = Pick<
  Session,
  | "endpoint"
  | "model"
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
  try {
    if (typeof value.endpoint !== "string" || !value.endpoint.trim())
      throw Error();
    builderEndpoint(value.endpoint.trim());
  } catch {
    throw Error(
      "endpoint에 HTTPS 또는 로컬 HTTP Chat Completions 전체 주소를 입력하세요.",
    );
  }
  if (typeof value.model !== "string" || !value.model.trim())
    throw Error("model에 서버가 제공하는 모델명을 입력하세요.");
  if (value.token !== undefined && typeof value.token !== "string")
    throw Error("token은 문자열이어야 합니다.");
  const settings: Settings = {
    endpoint: value.endpoint.trim(),
    model: value.model.trim(),
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
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  function edit(text: string) {
    setDraft(text);
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
    <details className="chat-json">
      <summary>JSON 설정</summary>
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
                const { settings, token } = parseSettings(draft ?? current);
                apply(settings, token);
                setDraft(null);
                setError("");
                setNotice("설정을 적용했습니다.");
              } catch (err) {
                const field=err instanceof Error && [...allowed].find(k=>err.message.startsWith(k+"에") || err.message.startsWith(k+"은") || err.message.startsWith(k+"는"));
                const unknown = err instanceof Error && /^지원하지 않는 항목: (.+)$/.exec(err.message)?.[1];
                const key=field || unknown;
                const el=input.current;
                if (el) {
                  const index=err && typeof err==="object" && "offset" in err && typeof err.offset==="number" ? err.offset : key ? Math.max(0,el.value.indexOf(JSON.stringify(key))) : 0;
                  el.focus();el.setSelectionRange(index,index+(key ? JSON.stringify(key).length : 1));
                }
                setNotice("");
                setError(
                  err instanceof Error ? err.message : "입력을 확인하세요.",
                );
              }
            }}
          >
            JSON 적용
          </button>
          <button onClick={() => edit(current)}>현재 설정 불러오기</button>
          <button onClick={saveFile}>현재 설정 내보내기</button>
        </div>
        <small>
          토큰은 token 항목으로 입력할 수 있습니다. 내보낸 파일에는 포함되지
          않습니다.
        </small>
        {error && <p role="alert">{error}</p>}
        {notice && <p aria-live="polite">{notice}</p>}
      </fieldset>
    </details>
  );
}
