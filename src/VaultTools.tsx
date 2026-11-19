import { useEffect, useState } from "react";
import { X, RotateCcw, History, Trash2 } from "lucide-react";
import { api } from "./api";
import type { Note, HistoryEntry, TrashEntry } from "./types";
export default function VaultTools({
  mode,
  note,
  onClose,
  onRestored,
  readonly = false,
}: {
  mode: "history" | "trash";
  note?: Note;
  onClose: () => void;
  onRestored: (note: Note) => void;
  readonly?: boolean;
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
  async function purge(entries: TrashEntry[], all = false) {
    if (busy || readonly || !api.purgeTrash || !entries.length) return;
    const target = all
      ? "휴지통의 " + entries.length + "개 항목을"
      : "‘" + entries[0].title + "’ 항목을";
    if (!confirm(target + " 영구삭제할까요? 삭제 후에는 복원할 수 없습니다."))
      return;
    setBusy(true);
    setError("");
    try {
      await api.purgeTrash(entries.map((n) => n.token));
      setPreview("");
    } catch (err) {
      setError(String(err));
    } finally {
      try {
        setTrash(await api.listTrash!());
      } catch (err) {
        setError(String(err));
      }
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
        {mode === "trash" && api.purgeTrash && (
          <button
            className="button"
            disabled={busy || readonly || !trash.length}
            onClick={() => void purge(trash, true)}
          >
            휴지통 비우기
          </button>
        )}
        {error && <p role="alert">{error}</p>}
        {!rows.length && <p className="muted">아직 보관된 항목이 없습니다.</p>}
        {rows.map((n) => (
          <div className="recovery-row" key={n.key}>
            <button onClick={() => setPreview(n.body)}>
              <strong>{n.title}</strong>
              <small>{n.date ? new Date(n.date).toLocaleString() : ""}</small>
            </button>
            <button
              className="button"
              disabled={busy || readonly}
              onClick={() => void restore(n.key)}
            >
              <RotateCcw size={14} />
              복원
            </button>
            {mode === "trash" && api.purgeTrash && (
              <button
                className="button"
                disabled={busy || readonly}
                aria-label={n.title + " 영구삭제"}
                onClick={() =>
                  void purge(trash.filter((item) => item.token === n.key))
                }
              >
                영구삭제
              </button>
            )}
          </div>
        ))}
        {preview && <pre className="history-preview">{preview}</pre>}
        <p className="small-text muted">
          {mode === "history"
            ? "이력을 복원하면 현재 내용도 보관합니다."
            : "복원하면 페이지를 다시 열 수 있습니다."}
        </p>
      </section>
    </div>
  );
}
