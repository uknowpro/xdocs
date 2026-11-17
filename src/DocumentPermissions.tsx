import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "./api";
export default function DocumentPermissions({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<
      { principal: string; role: string; read_only: boolean }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api.documentPermissions!(id)
      .then(setRows)
      .catch((e) => setError(String(e)));
  }, [id]);
  return (
    <div className="overlay">
      <section className="dialog" role="dialog" aria-label="문서 권한">
        <header>
          <h2>문서 권한</h2>
          <button
            className="icon-button"
            aria-label="문서 권한 닫기"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <p className="muted">
          조직 구성원의 이 문서 편집을 제한합니다. 소유자는 관리 권한을
          유지하고, 열람자는 편집 권한을 얻지 않습니다.
        </p>
        {error && <p role="alert">{error}</p>}
        {rows.map((row) => (
          <label className="recovery-row" key={row.principal}>
            <span style={{ overflowWrap: "anywhere" }}>
              {row.principal}
              <small> · {row.role}</small>
            </span>
            <input
              type="checkbox"
              aria-label={`${row.principal} 읽기 전용`}
              checked={row.role === "reader" || row.read_only}
              disabled={busy || row.role !== "editor"}
              onChange={async (e) => {
                setBusy(true);
                try {
                  setRows(
                    await api.documentPermissions!(
                      id,
                      row.principal,
                      e.target.checked,
                    ),
                  );
                } catch (error) {
                  setError(String(error));
                } finally {
                  setBusy(false);
                }
              }}
            />
            읽기 전용
          </label>
        ))}
      </section>
    </div>
  );
}
