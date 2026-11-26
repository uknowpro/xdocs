import { useEffect, useId, useRef, useState } from "react";
import { chatCompletionsEndpoint, sameChatEndpoint } from "../desktop/builder-model.mjs";
import { api } from "./api";
import { diagnosticFailure, testXcodeConnection } from "./xcode-diagnostic";
import { serverOrigin } from "./xcode-queue";
import type { ModelProfile } from "./types";
import type { SessionConnection } from "./xcode-session";

const storageKey = "xdocs.xcode.defaultConnection";
const empty: SessionConnection = { endpoint: "", model: "", profile: "" };

export function readXcodeDefaults(): SessionConnection | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      typeof value?.endpoint !== "string" ||
      typeof value.model !== "string" ||
      !value.model.trim() ||
      typeof value.profile !== "string"
    )
      return;
    chatCompletionsEndpoint(value.endpoint);
    return {
      endpoint: value.endpoint,
      model: value.model,
      profile: value.profile,
    };
  } catch {
    return;
  }
}

export default function XcodeDefaults() {
  const [saved, setSaved] = useState(readXcodeDefaults);
  const [draft, setDraft] = useState(() => saved ?? empty);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [key, setKey] = useState("");
  const [keyOrigin, setKeyOrigin] = useState("");
  const [testing, setTesting] = useState(false);
  const testRequest = useRef<{ id: string; controller: AbortController } | undefined>(undefined);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useId();
  useEffect(() => {
    let active = true;
    void api.builderProfiles?.().then(
      (items) => {
        if (active) setProfiles(items);
      },
      (cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : String(cause));
      },
    );
    return () => {
      active = false;
      const request = testRequest.current;
      testRequest.current = undefined;
      if (request) {
        request.controller.abort();
        void api.xcodeCancel?.(request.id).catch(() => {});
      }
    };
  }, []);

  const matches = (connection: Pick<SessionConnection, "endpoint" | "model">) =>
    connection.model === draft.model.trim() &&
    sameChatEndpoint(connection.endpoint, draft.endpoint);
  const selected = profiles.find((profile) => profile.name === draft.profile);
  const reusable =
    selected ?? (saved?.profile === draft.profile ? saved : undefined);
  const profile = reusable && matches(reusable) ? draft.profile : "";

  const origin = serverOrigin(draft.endpoint);
  const tokenNeedsApproval = Boolean(key.trim() && origin && origin !== keyOrigin);
  async function testConnection() {
    if (testing || busy || tokenNeedsApproval) return;
    const request = { id: crypto.randomUUID(), controller: new AbortController() };
    testRequest.current = request;
    setTesting(true);
    setStatus("");
    setError("");
    try {
      const text = await testXcodeConnection({ ...draft, profile, key: key.trim() }, "text", request.id, request.controller.signal);
      if (testRequest.current === request) setStatus(text);
    } catch (cause) {
      if (testRequest.current === request) setError(diagnosticFailure(cause));
    } finally {
      if (testRequest.current === request) {
        testRequest.current = undefined;
        setTesting(false);
      }
    }
  }

  function update(next: SessionConnection) {
    setDraft(next);
    setStatus("");
    setError("");
  }

  async function save() {
    if (busy || testing || tokenNeedsApproval || !api.saveXcodeProfile) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const endpoint = draft.endpoint.trim();
      const model = draft.model.trim();
      chatCompletionsEndpoint(endpoint);
      if (!model) throw Error("서버에서 사용하는 모델명을 입력하세요.");
      const next: SessionConnection = {
        endpoint,
        model,
        profile,
      };
      if (key.trim()) {
        const name =
          "xcode 기본 · " + model.slice(0, 45) + " · " + crypto.randomUUID();
        const updated = await api.saveXcodeProfile({
          ...next,
          name,
          key: key.trim(),
          remember: true,
        });
        setProfiles(updated);
        next.profile = name;
      }
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(next);
      setDraft(next);
      setKey("");
      setStatus("기본 연결을 저장했습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    localStorage.removeItem(storageKey);
    setSaved(undefined);
    setDraft(empty);
    setKey("");
    setError("");
    setStatus("기본 연결을 해제했습니다.");
  }

  return (
    <section className="xcode-defaults" aria-labelledby={heading}>
      <h3 id={heading}>새 세션의 기본 모델</h3>
      <p className="xcode-defaults-current">{saved ? <>저장된 모델 <strong>{saved.model}</strong></> : "저장된 기본 모델 없음"}</p>
      <p>이 기기에서 만드는 새 세션은 저장한 API 주소, 모델명, 토큰을 바로 사용합니다.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || testing} aria-label="xcode 기본 연결">
          {!!profiles.length && (
            <label>
              저장된 모델 프로필
              <select
                value={profile}
                onChange={(event) => {
                  const item = profiles.find(
                    (candidate) => candidate.name === event.target.value,
                  );
                  setKey("");
                  update(
                    item
                      ? {
                          endpoint: item.endpoint,
                          model: item.model,
                          profile: item.name,
                        }
                      : { ...draft, profile: "" },
                  );
                }}
              >
                <option value="">직접 입력</option>
                {profiles.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            API 주소
            <input
              required
              value={draft.endpoint}
              placeholder="https://server.example/v1"
              onChange={event => update({ ...draft, endpoint: event.target.value })}
            />
          </label>
          <label>
            모델명
            <input
              required
              value={draft.model}
              onChange={(event) =>
                update({ ...draft, model: event.target.value })
              }
            />
          </label>
          <label>
            API 토큰 (선택)
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setKeyOrigin(origin);
                setStatus("");
                setError("");
              }}
              placeholder={
                profile && selected?.hasKey ? "저장된 토큰 사용" : undefined
              }
            />
            <small className="token-status" aria-live="polite">
              {tokenNeedsApproval ? "새 주소에서 사용 승인 필요" : key.trim() ? "저장 시 이 기기에 보관" : profile && selected?.hasKey ? "이 기기에 저장됨" : "저장된 토큰 없음"}
            </small>
          </label>
          {tokenNeedsApproval && <button type="button" className="button small" onClick={() => setKeyOrigin(origin)}>
            변경한 주소에서 입력한 토큰 사용
          </button>}
        </fieldset>
        <div className="xcode-defaults-actions">
          <div className="row">
            {api.xcodeChat && <button type="button" className="button" disabled={busy || testing || tokenNeedsApproval} onClick={() => void testConnection()}>
              {testing ? "연결 테스트 중…" : "연결 테스트"}
            </button>}
            <button type="submit" className="button" disabled={busy || testing || tokenNeedsApproval}>
              기본 연결 저장
            </button>
            {saved && (
              <button type="button" className="button" onClick={clear} disabled={busy || testing}>
                기본 연결 해제
              </button>
            )}
          </div>
          {status && <p role="status">{status}</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      </form>
    </section>
  );
}
