import { useEffect, useMemo, useRef, useState } from "react";
import {
  readWorkspaceReviews,
  type WorkspaceReviewEntry,
} from "./xcode-checkpoint";
import type { Note } from "./types";

export default function WorkspaceReviewSearch({
  scope,
  notes,
  close,
  open,
}: {
  scope: string;
  notes: Note[];
  close: () => void;
  open: (entry: WorkspaceReviewEntry) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<WorkspaceReviewEntry[]>();
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState<"all" | "note" | "office">("all");
  const [error, setError] = useState(""),
    [limit, setLimit] = useState(40);
  useEffect(() => {
    dialog.current?.showModal();
    let mounted = true;
    void readWorkspaceReviews(scope)
      .then((items) => {
        if (mounted) setEntries(items);
      })
      .catch((err) => {
        if (mounted) setError(String(err));
      });
    return () => {
      mounted = false;
    };
  }, [scope]);
  const matches = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return (entries || [])
      .flatMap((entry) => {
        if (kind !== "all" && entry.kind !== kind) return [];
        const session = notes.find((n) => n.id === entry.session);
        if (!session) return [];
        const title =
          entry.kind === "note"
            ? notes.find((n) => n.id === entry.record.page)?.title ||
              entry.record.title
            : entry.record.form;
        const refs =
          entry.kind === "note"
            ? entry.record.citations || []
            : entry.record.fields.flatMap((field) => field.sources);
        const words =
          entry.kind === "office"
            ? entry.record.fields.flatMap((field) => [
                field.label,
                field.reason,
              ])
            : [];
        const content = [title, session.title, ...refs, ...words]
          .join(" ")
          .toLocaleLowerCase();
        if (!terms.every((term) => content.includes(term))) return [];
        return [
          {
            entry,
            session: session.title,
            title,
            refs: [...new Set(refs)],
            date:
              entry.kind === "note"
                ? entry.record.date
                : entry.record.reviewedAt,
          },
        ];
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, notes, kind, query]);
  return (
    <dialog
      ref={dialog}
      className="material-dialog workspace-review-search"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <strong>워크스페이스 검토 이력</strong>
        <button onClick={close}>닫기</button>
      </header>
      <input
        autoFocus
        aria-label="검토 이력 검색"
        placeholder="노트·양식 이름 또는 출처"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(40);
        }}
      />
      <select
        aria-label="검토 이력 종류"
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as typeof kind);
          setLimit(40);
        }}
      >
        <option value="all">전체</option>
        <option value="note">노트 반영</option>
        <option value="office">Office 검토</option>
      </select>
      {error ? (
        <p role="alert">{error}</p>
      ) : !entries ? (
        <p role="status">검토 이력을 불러오는 중…</p>
      ) : !matches.length ? (
        <p>일치하는 검토 이력이 없습니다.</p>
      ) : null}
      <div className="review-search-results">
        {matches
          .slice(0, limit)
          .map(({ entry, session, title, refs, date }, i) => (
            <details key={entry.session + "-" + i}>
              <summary>
                {title} · {session}
              </summary>
              <small>
                {new Date(date).toLocaleString()} ·{" "}
                {entry.kind === "office"
                  ? "Office 검토"
                  : entry.record.state === "undone"
                    ? "되돌림"
                    : entry.record.state === "pending"
                      ? "저장 확인 필요"
                      : "노트 반영"}
              </small>
              {refs.length > 0 && (
                <ul>
                  {refs.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ul>
              )}
              {entry.kind === "office" && (
                <ul>
                  {entry.record.fields
                    .filter((field) => field.reason)
                    .map((field) => (
                      <li key={field.id}>
                        {field.label} · {field.reason}
                      </li>
                    ))}
                </ul>
              )}
              <button onClick={() => open(entry)}>
                {entry.kind === "note" ? "답변 열기" : "세션 열기"}
              </button>
            </details>
          ))}
      </div>
      {matches.length > limit && (
        <button onClick={() => setLimit(limit + 40)}>더 보기</button>
      )}
    </dialog>
  );
}
