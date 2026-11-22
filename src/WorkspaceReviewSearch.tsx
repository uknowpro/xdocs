import { useEffect, useMemo, useRef, useState } from "react";
import {
  mergeReviewSlots,
  readWorkspaceReviews,
  type WorkspaceReviewEntry,
} from "./xcode-checkpoint";
import { exportReviewBackup, inspectReviewBackup } from "./review-backup";
import { officeOutputHash, type OfficeOutput } from "./review-export";
import type { Note } from "./types";

const labels = {
  applied: "저장 완료",
  undone: "되돌림",
  pending: "저장 확인 필요",
  conflict:"원본 충돌",
  verified: "작성본 검사 통과",
  structure: "Word 구조 검사 통과",
  office: "Office 검토",
} as const;
type Result = keyof typeof labels;

function OutputReview({ output }: { output: OfficeOutput }) {
  const [result, setResult] = useState("");
  return (
    <section className="review-output">
      <strong>{output.filename}</strong>
      <small>
        {new Date(output.savedAt).toLocaleString()} · {labels[output.status]}
      </small>
      <small>
        입력 위치 {output.fields}개 · 수식 {output.formulas}개 비교
      </small>
      <label>
        작성본 대조
        <input
          type="file"
          accept=".docx,.xlsx"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const same =
                file.size === output.bytes &&
                (await officeOutputHash(
                  new Uint8Array(await file.arrayBuffer()),
                )) === output.sha256;
              setResult(
                same
                  ? "저장 당시 검사한 작성본과 동일합니다."
                  : "저장 당시 검사한 작성본과 다릅니다.",
              );
            } catch (err) {
              setResult(String(err));
            }
          }}
        />
      </label>
      {result && <small role="status">{result}</small>}
    </section>
  );
}
export default function WorkspaceReviewSearch({
  scope,
  notes,
  close,
  open,
  readonly = false,
}: {
  scope: string;
  notes: Note[];
  close: () => void;
  open: (entry: WorkspaceReviewEntry) => void;
  readonly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<WorkspaceReviewEntry[]>();
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState<"all" | "note" | "office">("all");
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [sessionId, setSessionId] = useState(""),
    [status, setStatus] = useState<Result | "">("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [limit, setLimit] = useState(40),
    [working, setWorking] = useState(false);
  const [restore, setRestore] =
    useState<Awaited<ReturnType<typeof inspectReviewBackup>>>();
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
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
  const sessions = useMemo(
    () =>
      [...new Set((entries || []).map((entry) => entry.session))].flatMap(
        (id) => {
          const note = notes.find((n) => n.id === id);
          return note ? [note] : [];
        },
      ),
    [entries, notes],
  );
  const matches = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return (entries || [])
      .flatMap((entry) => {
        if (
          (kind !== "all" && entry.kind !== kind) ||
          (sessionId && entry.session !== sessionId)
        )
          return [];
        const session = notes.find((n) => n.id === entry.session);
        if (!session) return [];
        const office = entry.kind === "office";
        const title = office
          ? entry.record.form
          : notes.find((n) => n.id === entry.record.page)?.title ||
            entry.record.title;
        const refs = office
          ? entry.record.fields.flatMap((field) => field.sources)
          : entry.record.citations || [];
        const words = office
          ? [
              entry.record.output?.filename,
              ...entry.record.fields.flatMap((field) => [
                field.label,
                field.reason,
              ]),
            ]
          : [];
        const date = office
          ? entry.record.output?.savedAt || entry.record.reviewedAt
          : entry.record.date;
        const result: Result = office
          ? entry.record.output?.status || "office"
          : entry.record.state;
        const localDate = new Date(date).toLocaleDateString("sv-SE");
        if (
          (status && status !== result) ||
          (start && localDate < start) ||
          (end && localDate > end)
        )
          return [];
        if (
          !terms.every((term) =>
            [title, session.title, ...refs, ...words]
              .join(" ")
              .toLocaleLowerCase()
              .includes(term),
          )
        )
          return [];
        return [
          {
            entry,
            session: session.title,
            title,
            refs: [...new Set(refs)],
            date,
            result,
          },
        ];
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, notes, kind, query, start, end, sessionId, status]);
  const groups = new Map<string, typeof matches>();
  for (const row of matches) {
    const key =
      row.entry.kind === "note" && row.entry.record.group
        ? row.entry.session + "-" + row.entry.record.group
        : "single-" + groups.size;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  function renderResult({
    entry,
    session,
    title,
    refs,
    date,
    result,
  }: (typeof matches)[number]) {
    return (
      <details
        key={
          entry.kind === "note"
            ? entry.record.id
            : entry.record.reviewedAt + entry.record.identity
        }
      >
        <summary>
          {title} · {session}
        </summary>
        <small>
          {new Date(date).toLocaleString()} · {labels[result]}
        </small>
        {refs.length > 0 && (
          <ul>
            {refs.map((ref) => (
              <li key={ref}>{ref}</li>
            ))}
          </ul>
        )}
        {entry.kind === "office" && (
          <>
            <ul>
              {entry.record.fields
                .filter((field) => field.reason)
                .map((field) => (
                  <li key={field.id}>
                    {field.label} · {field.reason}
                  </li>
                ))}
            </ul>
            {entry.record.output && (
              <OutputReview output={entry.record.output} />
            )}
          </>
        )}
        <button onClick={() => open(entry)}>
          {entry.kind === "note" ? "답변 열기" : "세션 열기"}
        </button>
      </details>
    );
  }
  async function readBackup(file?: File) {
    if (!file) return;
    setWorking(true);
    setError("");
    setRestore(undefined);
    try {
      setRestore(await inspectReviewBackup(scope, notes, file));
    } catch (err) {
      setError(String(err));
    } finally {
      setWorking(false);
    }
  }
  async function loadBackup() {
    if (!restore || readonly || working) return;
    setWorking(true);
    setError("");
    try {
      const result = await mergeReviewSlots(scope, restore.entries);
      setEntries(await readWorkspaceReviews(scope));
      setRestore(undefined);
      setMessage(
        "복원 " +
          result.restored +
          "개 · 중복 " +
          (restore.duplicates + result.duplicates) +
          "개. 진행 중인 Office 세션은 앱 재시작 후 초안을 읽습니다.",
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setWorking(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="material-dialog workspace-review-search"
      onCancel={(event) => {
        event.preventDefault();
        if (!working) close();
      }}
    >
      <header>
        <strong>워크스페이스 검토 이력</strong>
        <button disabled={working} onClick={close}>
          닫기
        </button>
      </header>
      <input
        autoFocus
        aria-label="검토 이력 검색"
        placeholder="노트·양식 이름 또는 출처"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setLimit(40);
        }}
      />
      <details className="review-filters">
        <summary>필터</summary>
        <div>
          <select
            aria-label="검토 이력 종류"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setLimit(40);
            }}
          >
            <option value="all">모든 작업</option>
            <option value="note">노트 반영</option>
            <option value="office">Office 검토</option>
          </select>
          <select
            aria-label="검토 이력 세션"
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setLimit(40);
            }}
          >
            <option value="">모든 세션</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
          <select
            aria-label="검토 이력 결과"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setLimit(40);
            }}
          >
            <option value="">모든 결과</option>
            {Object.entries(labels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <label>
            시작일
            <input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setLimit(40);
              }}
            />
          </label>
          <label>
            종료일
            <input
              type="date"
              min={start || undefined}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setLimit(40);
              }}
            />
          </label>
          <button
            onClick={() => {
              setKind("all");
              setSessionId("");
              setStatus("");
              setStart("");
              setEnd("");
              setLimit(40);
            }}
          >
            필터 지우기
          </button>
        </div>
      </details>
      {error ? (
        <p role="alert">{error}</p>
      ) : !entries ? (
        <p role="status">검토 이력을 불러오는 중…</p>
      ) : !matches.length ? (
        <p>일치하는 검토 이력이 없습니다.</p>
      ) : null}
      <div className="review-search-results">
        {[...groups].slice(0, limit).map(([key, group]) =>
          group.length > 1 ? (
            <details key={key} className="application-history-group">
              <summary>
                노트 반영 작업 · {group.length}건 · {group[0].session}
              </summary>
              {group.map(renderResult)}
            </details>
          ) : (
            renderResult(group[0])
          ),
        )}
      </div>
      {groups.size > limit && (
        <button onClick={() => setLimit(limit + 40)}>더 보기</button>
      )}
      <details className="review-backup">
        <summary>검토 백업</summary>
        <p>
          검토 텍스트와 Office 양식이 포함됩니다. 노트 파일은 같은
          워크스페이스에서 따로 옮겨 주세요.
        </p>
        <button
          disabled={working}
          onClick={async () => {
            setWorking(true);
            setError("");
            try {
              const count = await exportReviewBackup(scope, notes);
              setMessage("검토 백업 " + count + "개를 내보냈습니다.");
            } catch (err) {
              setError(String(err));
            } finally {
              setWorking(false);
            }
          }}
        >
          검토 백업 내보내기
        </button>
        {!readonly && (
          <label>
            검토 백업 가져오기
            <input
              type="file"
              accept=".json,application/json"
              disabled={working}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void readBackup(file);
              }}
            />
          </label>
        )}
        {restore && (
          <div>
            <p>
              복원 가능 {restore.entries.length}개 · 중복 {restore.duplicates}개
              · 연결할 페이지 없음 또는 읽을 수 없음 {restore.missing}개
            </p>
            <button
              disabled={working || !restore.entries.length}
              onClick={() => void loadBackup()}
            >
              중복 제외하고 복원
            </button>
            <button disabled={working} onClick={() => setRestore(undefined)}>
              취소
            </button>
          </div>
        )}
        {message && <small role="status">{message}</small>}
      </details>
    </dialog>
  );
}
