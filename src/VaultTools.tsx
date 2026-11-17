import { useEffect, useState } from "react";
import { X, RotateCcw, History, Trash2 } from "lucide-react";
import { api } from "./api";
import type { Note, HistoryEntry, TrashEntry } from "./types";
export default function VaultTools({
  mode,
  note,
  onClose,
  onRestored,
}: {
  mode: "history" | "trash";
  note?: Note;
  onClose: () => void;
  onRestored: (note: Note) => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]),
    [trash, setTrash] = useState<TrashEntry[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState("");
  useEffect(() => {
    (mode === "history" && note
      ? api.history!(note.id).then(setHistory)
      : api.listTrash!().then(setTrash)
    ).catch((e) => setError(String(e)));
  }, [mode, note]);
  async function restore(revisionOrToken: string) {
    setBusy(true);
    try {
      const n =
        mode === "history"
          ? await api.restoreHistory!({
              id: note!.id,
              revision: note!.revision,
              historyRevision: revisionOrToken,
            })
          : await api.restoreTrash!(revisionOrToken);
      onRestored(n);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const rows =
    mode === "history"
      ? history.map((n) => ({ ...n, key: n.revision, date: n.savedAt }))
      : trash.map((n) => ({ ...n, key: n.token, date: n.deletedAt }));
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="dialog recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "history" ? "변경 이력" : "휴지통"}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>
            {mode === "history" ? <History size={20} /> : <Trash2 size={20} />}{" "}
            {mode === "history" ? "변경 이력" : "휴지통"}
          </h2>
          <button
            className="icon-button"
            aria-label="복원 창 닫기"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        {error && <p role="alert">{error}</p>}
        {!rows.length && <p className="muted">아직 보관된 항목이 없습니다.</p>}
        {rows.map((n) => (
          <div className="recovery-row" key={n.key}>
            <button onClick={() => setPreview(n.body)}>
              <strong>{n.title}</strong>
              <small>{new Date(n.date).toLocaleString()}</small>
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void restore(n.key)}
            >
              <RotateCcw size={14} />
              복원
            </button>
          </div>
        ))}
        {preview && <pre className="history-preview">{preview}</pre>}
        <p className="small-text muted">
          변경 이력 복원 시 현재 내용도 보관합니다. 휴지통 복원 파일은 보관함
          최상위에 새 이름으로 저장합니다.
        </p>
      </section>
    </div>
  );
}
