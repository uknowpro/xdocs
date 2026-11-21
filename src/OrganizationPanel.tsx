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
}: {
  onClose: () => void;
  onOpen: (w: Workspace | null) => void;
}) {
  const [server, setServer] = useState("http://127.0.0.1:4242"),
    [list, setList] = useState<OrganizationInfo[]>([]),
    [conflicts, setConflicts] = useState<OrganizationConflict[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
        <p className="small-text muted">
          조직 서버에 로그인하면 접근 권한이 있는 보관함만 표시됩니다. 개인
          노트는 자동으로 공유하지 않습니다.
        </p>
        <label className="server-field">
          서버 주소
          <input
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="https://notes.example.com"
          />
        </label>
        <div className="row">
          <button
            className="button primary"
            disabled={busy || !isDesktop}
            onClick={() =>
              void run(async () =>
                setList(await api.organizationLogin!(server)),
              )
            }
          >
            <LogIn size={15} />
            {busy ? "연결 중…" : "브라우저에서 SSO 로그인"}
          </button>
          <button
            className="button"
            disabled={busy || !isDesktop}
            onClick={() =>
              void run(async () => onOpen(await api.organizationLogout!()))
            }
          >
            로그아웃
          </button>
        </div>
        {!isDesktop && (
          <p className="small-text muted">
            조직 연결은 데스크톱 앱에서 사용할 수 있습니다.
          </p>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {list.map((w) => (
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
