import {createTwoFilesPatch} from "diff";
import { useEffect, useState } from "react";
import { Building2, LogIn, RefreshCw, X } from "lucide-react";
import { api, isDesktop } from "./api";
import type {
  Workspace,
  OrganizationInfo,
  OrganizationConflict,
} from "./types";
export default function OrganizationPanel({
  onClose,
  onOpen,
  connectedWorkspace,
}: {
  connectedWorkspace?: string;
  onClose: () => void;
  onOpen: (w: Workspace | null) => void;
}) {
  const [server, setServer] = useState("http://127.0.0.1:4242"),
    [list, setList] = useState<OrganizationInfo[]>([]),
    [conflicts, setConflicts] = useState<OrganizationConflict[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [step, setStep] = useState<"server" | "login" | "workspace">("server");
  useEffect(() => {
    api
      .organizationConflicts?.()
      .then(setConflicts)
      .catch((e) => setError(String(e)));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="dialog recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="조직 연결"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>
            <Building2 size={20} />
            조직 연결
          </h2>
          <button
            className="icon-button"
            aria-label="조직 연결 닫기"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        {connectedWorkspace && <p className="small-text">사용 중 · {connectedWorkspace}</p>}
        <ol className="organization-steps" aria-label="조직 연결 단계">
          {([["server", "서버"], ["login", "SSO 로그인"], ["workspace", "워크스페이스"]] as const).map(([id, title]) => (
            <li key={id} aria-current={step === id ? "step" : undefined}>{title}</li>
          ))}
        </ol>
        {step !== "workspace" && <form onSubmit={event => {
          event.preventDefault();
          if (!api.organizationLogin || !server.trim() || busy) return;
          setStep("login");
          void run(async () => {
            try {
              setList(await api.organizationLogin!(server.trim()));
              setStep("workspace");
            } catch (cause) {
              setStep("server");
              throw cause;
            }
          });
        }}>
          <label className="server-field">
            서버 주소
            <input required value={server} disabled={busy} onChange={event => setServer(event.target.value)}
              placeholder="https://notes.example.com" />
          </label>
          <div className="row">
            <button type="submit" className="button primary" disabled={busy || !isDesktop || !server.trim()}>
              <LogIn size={15} />{step === "login" ? "브라우저 로그인 대기 중…" : "브라우저에서 SSO 로그인"}
            </button>
          </div>
        </form>}
        {step === "workspace" && <section className="organization-choices" aria-label="조직 워크스페이스 선택">
          <h3>워크스페이스 선택</h3>
          <p className="small-text">{server}</p>
          {!list.length && <p>접근할 수 있는 워크스페이스가 없습니다.</p>}
        </section>}
        {!isDesktop && <p className="small-text muted">조직 연결은 데스크톱 앱에서 사용할 수 있습니다.</p>}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {step === "workspace" && list.map((w) => (
          <div className="recovery-row" key={w.id}>
            <span>
              <strong>{w.name}</strong>
              <small>
                {w.role === "reader"
                  ? "열람 전용"
                  : w.role === "owner"
                    ? "관리자"
                    : "편집 가능"}
              </small>
            </span>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void run(async () => onOpen(await api.organizationOpen!(w.id)))
              }
            >
              열기
            </button>
          </div>
        ))}
        {(step === "workspace" || connectedWorkspace) && <div className="row organization-actions">
          {step === "workspace" && <button className="button" disabled={busy} onClick={() => {
            setList([]);
            setError("");
            setStep("server");
          }}>다른 서버 연결</button>}
          <button className="button" disabled={busy || !api.organizationLogout}
            onClick={() => void run(async () => onOpen(await api.organizationLogout!()))}>로그아웃</button>
        </div>}
        {conflicts.length > 0 && (
          <>
            <h3>동기화 충돌</h3>
            <p className="small-text muted">
              내 변경을 사본으로 남기거나 서버 버전을 선택하세요.
            </p>
            {conflicts.map((c) => (
              <div key={c.id} className="conflict-entry">
                <strong>{c.title}</strong>
                <details>
                  <summary>내용 비교</summary>
                  <div className="conflict-versions"><section><h4>내 변경</h4>
                  <pre>{c.body}</pre>
                  </section><section><h4>서버 버전</h4>
                  <pre>{c.server.body ?? "삭제된 문서"}</pre></section></div>
                </details>
                <details><summary>줄 단위 변경 보기</summary><pre className="review-diff">{createTwoFilesPatch("서버 버전","내 변경",c.server.body || "",c.body)}</pre></details>
                <div className="row conflict-actions">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () =>
                        onOpen(await api.organizationResolve!(c.id, "copy")),
                      )
                    }
                  >
                    내 변경 사본 보존
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("내 변경을 버리고 서버 버전을 사용할까요?"))
                        void run(async () =>
                          onOpen(
                            await api.organizationResolve!(c.id, "server"),
                          ),
                        );
                    }}
                  >
                    서버 버전 사용
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        <p className="small-text muted" style={{ marginTop: 20 }}>
          조직 문서는 15초마다 동기화를 시도합니다. 네트워크가 끊겨도 편집
          내용은 이 기기의 변경 대기열에 남습니다.
        </p>
      </section>
    </div>
  );
}
