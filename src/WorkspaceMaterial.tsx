import { useEffect, useMemo, useRef, useState } from "react";
import {
  downloadReview,
  markdownQuote,
  officeReviewMarkdown,
  type OfficeReview,
} from "./review-export";
import { diffLines, applyPatch, createPatch } from "diff";
import {
  readNoteApplications,
  readOfficeReview,
  saveNoteApplication,
  removeNoteApplication,
  type NoteApplication,
  type ApplicationDraft,
  type ApplicationProposal,
  writeApplicationDraft,
} from "./xcode-checkpoint";
import { pageKind } from "../shared/page-kind.mjs";
import {
  architecture,
  noteBlocks,
  snapshot,
  workbook,
  type WorkspaceAccess,
  type Selection,
  type TextInput,
} from "./workspace-input";
import type { Note } from "./types";

export type MaterialAction =
  | { kind: "attach"; query?: string }
  | { kind: "compare"; file: TextInput }
  | {
      kind: "apply";
      answer: string;
      turn: number;
      runId?: string;
      citations?: string[];
    }
  | { kind: "history" };
type Proposal = ApplicationProposal;
type UndoCandidate = {
  record: NoteApplication;
  note?: Note;
  body?: string;
  checked: boolean;
  problem?: string;
};
type SaveResult = {
  page: string;
  title: string;
  state: "saved" | "conflict" | "held";
  problem?: string;
};
export default function WorkspaceMaterial({
  access,
  action,
  close,
  attach,
  sessionKey,
  resumeDraft,
  draftChanged,
}: {
  access: WorkspaceAccess;
  sessionKey: string;
  resumeDraft?: ApplicationDraft;
  draftChanged: (value?: ApplicationDraft) => void;
  action: MaterialAction;
  close: () => void;
  attach: (file: TextInput, original?: TextInput) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const original = action.kind === "compare" ? action.file : undefined;
  const [query, setQuery] = useState(
    action.kind === "attach" ? action.query || "" : "",
  );
  const [answer, setAnswer] = useState(
    resumeDraft?.answer ?? (action.kind === "apply" ? action.answer : ""),
  );
  const [proposals, setProposals] = useState<Proposal[]>(
    resumeDraft?.proposals || [],
  );
  const [batchUndo, setBatchUndo] = useState<{
    group: string;
    items: UndoCandidate[];
  }>();
  const [results, setResults] = useState<SaveResult[]>();
  const [officeReview, setOfficeReview] = useState<OfficeReview>();
  const [records, setRecords] = useState<NoteApplication[]>([]);
  const [undoSummary, setUndoSummary] = useState("");
  const [undo, setUndo] = useState<{
    record: NoteApplication;
    note: Note;
    body: string;
    conflict: boolean;
  }>();
  const [id, setId] = useState(
    resumeDraft?.id || original?.workspace?.page || "",
  );
  const [conflictBase, setConflictBase] = useState<Note>();
  const initialDraft = useRef(resumeDraft);
  const [note, setNote] = useState<Note | undefined>(resumeDraft?.baseline),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Selection | undefined>(
    original?.workspace?.selection,
  );
  const [block, setBlock] = useState(resumeDraft?.block ?? -1),
    [reload, setReload] = useState(0);
  const read = useRef(access.read);
  read.current = access.read;
  useEffect(() => {
    dialog.current?.showModal();
    if (action.kind === "history")
      void readOfficeReview(sessionKey)
        .then(setOfficeReview)
        .catch((e) => setError(String(e)));
    if (action.kind === "history")
      void readNoteApplications(sessionKey)
        .then((list) =>
          setRecords(list.sort((a, b) => b.date.localeCompare(a.date))),
        )
        .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    let live = true;
    const cached = initialDraft.current;
    initialDraft.current = undefined;
    if (cached?.id === id && cached.baseline) return;
    setNote(undefined);
    setError("");
    setBlock(-1);
    if (id)
      void read
        .current(id)
        .then((n) => {
          if (!live) return;
          setNote(n);
          if (!original) {
            const type = pageKind(n);
            setSelection(
              type === "sheets"
                ? {
                    kind: "sheets",
                    sheet: workbook(n)?.sheets[0].id || "",
                    range: "A1",
                  }
                : type === "architecture"
                  ? {
                      kind: "architecture",
                      resource: architecture(n)?.nodes[0]?.id || "",
                    }
                  : { kind: "note" },
            );
          }
        })
        .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [id, original, reload]);
  const pages = access.notes.filter(
    (n) =>
      (action.kind === "apply"
        ? pageKind(n) === "note" && n.role !== "reader"
        : ["note", "sheets", "architecture"].includes(pageKind(n))) &&
      (n.path + " " + n.title).toLowerCase().includes(query.toLowerCase()),
  );
  const choices = useMemo(
    () => (note && action.kind === "apply" ? noteBlocks(note.body) : []),
    [note, action.kind],
  );
  const preview = useMemo(() => {
    if (!note || !selection || action.kind === "apply") return {};
    try {
      return { file: snapshot(note, selection) };
    } catch (e) {
      return { error: String(e) };
    }
  }, [note, selection, action.kind]);
  const chosen = choices[block];
  const nextBody =
    note && action.kind === "apply"
      ? chosen
        ? note.body.slice(0, chosen.start) +
          answer.trimEnd() +
          note.body.slice(chosen.start, chosen.end).match(/\s*$/)![0] +
          note.body.slice(chosen.end)
        : note.body +
          (note.body.endsWith("\n\n")
            ? ""
            : note.body.endsWith("\n")
              ? "\n"
              : "\n\n") +
          answer +
          "\n"
      : "";
  const before = action.kind === "apply" ? note?.body : original?.text;
  const after = action.kind === "apply" ? nextBody : preview.file?.text;
  const changes = useMemo(
    () =>
      before !== undefined && after !== undefined
        ? diffLines(before, after, { timeout: 120 })
        : undefined,
    [before, after],
  );
  const [limit, setLimit] = useState(60);
  const latestWrite = useRef<Promise<unknown>>(Promise.resolve());
  function persist(draft?: ApplicationDraft) {
    latestWrite.current = writeApplicationDraft(sessionKey, draft).then(() =>
      draftChanged(draft),
    );
    return latestWrite.current;
  }
  useEffect(() => {
    if (action.kind !== "apply") return;
    const draft =
      id || proposals.length || answer !== action.answer
        ? {
            origin: {
              answer: action.answer,
              turn: action.turn,
              runId: action.runId,
              citations: action.citations,
            },
            id,
            baseline: note,
            answer,
            block,
            proposals,
          }
        : undefined;
    void persist(draft).catch((e) =>
      setError("검토 초안을 저장하지 못했습니다. " + String(e)),
    );
  }, [action, id, note, answer, block, proposals]);
  async function closeDialog() {
    try {
      await latestWrite.current;
      close();
    } catch (e) {
      setError(String(e));
    }
  }
  function stage(note: Note) {
    const existing = proposals.find((p) => p.note.id === note.id);
    setProposals((current) => [
      ...current.filter((p) => p.note.id !== note.id),
      {
        note,
        body: nextBody,
        answer,
        block,
        checked: existing?.checked ?? true,
      },
    ]);
    setId("");
    setConflictBase(undefined);
    setAnswer(action.kind === "apply" ? action.answer : "");
  }
  async function apply(p: Proposal, group?: string) {
    if (action.kind !== "apply" || p.note.body === p.body) return;
    const current = await access.read(p.note.id);
    if (current.body === p.body) return;
    if (current.revision !== p.note.revision)
      throw Error("원본이 변경되었습니다.");
    const record: NoteApplication = {
      id: crypto.randomUUID(),
      turn: action.turn,
      runId: action.runId,
      title: p.note.title,
      page: p.note.id,
      date: new Date().toISOString(),
      before: p.note.body,
      after: p.body,
      content: p.answer,
      citations: action.citations,
      state: "pending",
      group,
    };
    await saveNoteApplication(sessionKey, record);
    try {
      await access.save(p.note, p.body);
    } catch (err) {
      await removeNoteApplication(sessionKey, record.id);
      throw err;
    }
    await saveNoteApplication(sessionKey, { ...record, state: "applied" });
  }
  async function saveSelection() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (action.kind === "apply") {
        if (proposals.length) {
          let remaining = proposals;
          const checked = proposals.filter((p) => p.checked && !p.problem);
          const group = checked.length > 1 ? crypto.randomUUID() : undefined;
          const outcome: SaveResult[] = proposals
            .filter((p) => !p.checked || p.problem)
            .map((p) => ({
              page: p.note.id,
              title: p.note.title,
              state: p.checked ? "conflict" : "held",
              problem: p.problem,
            }));
          for (const proposal of proposals.filter(
            (p) => p.checked && !p.problem,
          )) {
            try {
              await apply(proposal, group);
              outcome.push({
                page: proposal.note.id,
                title: proposal.note.title,
                state: "saved",
              });
              remaining = remaining.filter(
                (p) => p.note.id !== proposal.note.id,
              );
            } catch (err) {
              outcome.push({
                page: proposal.note.id,
                title: proposal.note.title,
                state: "conflict",
                problem: String(err),
              });
              remaining = remaining.map((p) =>
                p.note.id === proposal.note.id
                  ? { ...p, problem: String(err) }
                  : p,
              );
            }
            setProposals(remaining);
            await persist(
              remaining.length
                ? {
                    origin: action,
                    id: "",
                    answer: action.answer,
                    block: -1,
                    proposals: remaining,
                  }
                : undefined,
            );
          }
          setResults(outcome);
          return;
        } else if (note && answer.trim() && block !== -2) {
          await apply({ note, body: nextBody, answer, block, checked: true });
          await persist();
        }
      } else if (preview.file) attach(preview.file, original);
      close();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }
  function exportHistory() {
    const items = records.map((record) =>
      [
        "## " + record.title.replace(/[\r\n]/g, " "),
        "",
        "답변 " +
          (record.turn + 1) +
          " · " +
          record.date +
          " · " +
          { applied: "저장 완료", pending: "저장 확인 필요", undone: "되돌림" }[
            record.state
          ],
        "",
        markdownQuote("노트: " + record.page),
        ...(record.content ? ["", markdownQuote(record.content)] : []),
        ...(record.citations?.length
          ? ["", markdownQuote("출처\n" + record.citations.join("\n"))]
          : []),
        "",
        ...(diffLines(record.before, record.after, { timeout: 120 })
          ?.filter((c) => c.added || c.removed)
          .map((c) =>
            markdownQuote((c.added ? "추가\n" : "삭제\n") + c.value),
          ) || []),
      ].join("\n"),
    );
    downloadReview(
      "xdocs-반영-검토-기록",
      [
        "# xdocs 반영 검토 기록",
        "",
        ...items,
        officeReviewMarkdown(officeReview),
      ].join("\n\n"),
    );
  }
  async function revisit(proposal: Proposal) {
    setError("");
    try {
      const fresh = await access.read(proposal.note.id);
      const target = noteBlocks(proposal.note.body)[proposal.block];
      const matches = target
        ? noteBlocks(fresh.body).flatMap((block, i) =>
            block.text === target.text ? [i] : [],
          )
        : [];
      initialDraft.current = {
        origin: action.kind === "apply" ? action : { answer: "", turn: 0 },
        id: fresh.id,
        baseline: fresh,
        block: proposal.block,
        answer: proposal.answer,
        proposals,
      };
      setId(fresh.id);
      setNote(fresh);
      setAnswer(proposal.answer);
      setBlock(
        proposal.block === -1 ? -1 : matches.length === 1 ? matches[0] : -2,
      );
      setConflictBase(proposal.note);
    } catch (err) {
      setError(String(err));
    }
  }
  async function previewUndo(record: NoteApplication) {
    setError("");
    setUndo(undefined);
    try {
      const current = await access.read(record.page);
      if (record.state === "pending" && current.body !== record.after)
        throw Error("이 변경의 저장 완료를 확인할 수 없습니다.");
      const reverted =
        current.body === record.after
          ? record.before
          : applyPatch(
              current.body,
              createPatch(record.title, record.after, record.before, "", "", {
                context: 2,
              }),
            );
      setUndo({
        record,
        note: current,
        body: reverted === false ? current.body : reverted,
        conflict: reverted === false,
      });
    } catch (err) {
      setError(String(err));
    }
  }
  async function prepareBatchUndo(group: string) {
    setError("");
    setUndo(undefined);
    const items = await Promise.all(
      records
        .filter(
          (record) => record.group === group && record.state === "applied",
        )
        .map(async (record) => {
          try {
            const note = await access.read(record.page);
            const rebuilt =
              note.body === record.after
                ? record.before
                : applyPatch(
                    note.body,
                    createPatch(
                      record.title,
                      record.after,
                      record.before,
                      "",
                      "",
                      { context: 2 },
                    ),
                  );
            if (rebuilt === false)
              return {
                record,
                note,
                checked: false,
                problem: "나중 편집과 겹칩니다.",
              };
            return { record, note, body: rebuilt, checked: true };
          } catch (err) {
            return { record, checked: false, problem: String(err) };
          }
        }),
    );
    setBatchUndo({ group, items });
  }
  async function applyBatchUndo() {
    if (!batchUndo || saving) return;
    setSaving(true);
    setError("");
    const remaining: UndoCandidate[] = [];
    let saved = 0;
    try {
      for (const item of batchUndo.items) {
        if (!item.checked || !item.note || item.body === undefined) {
          remaining.push(item);
          continue;
        }
        try {
          await access.save(item.note, item.body);
          await saveNoteApplication(sessionKey, {
            ...item.record,
            state: "undone",
          });
          setRecords((current) =>
            current.map((record) =>
              record.id === item.record.id
                ? { ...record, state: "undone" }
                : record,
            ),
          );
          saved++;
        } catch (err) {
          remaining.push({ ...item, checked: false, problem: String(err) });
        }
      }
      setBatchUndo(
        remaining.length
          ? { group: batchUndo.group, items: remaining }
          : undefined,
      );
      setUndoSummary(
        "되돌림 " + saved + "건 · 미처리 " + remaining.length + "건",
      );
    } finally {
      setSaving(false);
    }
  }
  async function confirmUndo() {
    if (!undo || saving) return;
    setSaving(true);
    setError("");
    try {
      await access.save(undo.note, undo.body);
      await saveNoteApplication(sessionKey, {
        ...undo.record,
        state: "undone",
      });
      setRecords((list) =>
        list.map((record) =>
          record.id === undo.record.id
            ? { ...record, state: "undone" }
            : record,
        ),
      );
      setUndo(undefined);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      className="material-dialog"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) void closeDialog();
      }}
    >
      <header>
        <strong>
          {action.kind === "history"
            ? "노트 반영 이력"
            : action.kind === "apply"
              ? "기존 노트에 반영"
              : original
                ? "첨부 버전 비교"
                : "워크스페이스 자료 첨부"}
        </strong>
        <button disabled={saving} onClick={() => void closeDialog()}>
          닫기
        </button>
      </header>
      {results && (
        <section className="application-results" aria-label="노트 반영 결과">
          <header>
            <strong>노트 반영 결과</strong>
            <button type="button" onClick={() => setResults(undefined)}>
              결과 닫기
            </button>
          </header>
          <p>
            {(["saved", "conflict", "held"] as const)
              .map(
                (state, i) =>
                  ["완료", "충돌·오류", "보류"][i] +
                  " " +
                  results.filter((item) => item.state === state).length +
                  "건",
              )
              .join(" · ")}
          </p>
          {results.map((result) => (
            <div className="application-row" key={result.page}>
              <span>
                {result.title} ·{" "}
                {
                  { saved: "완료", conflict: "재검토 필요", held: "보류" }[
                    result.state
                  ]
                }
                {result.problem && <small>{result.problem}</small>}
              </span>
              {result.state === "saved" ? (
                <button
                  onClick={() =>
                    void latestWrite.current
                      .then(() => access.openNote(result.page))
                      .catch((e) => setError(String(e)))
                  }
                >
                  노트 열기
                </button>
              ) : (
                <button
                  onClick={() => {
                    const current = proposals.find(
                      (p) => p.note.id === result.page,
                    );
                    if (current) void revisit(current);
                    setResults(undefined);
                  }}
                >
                  이 항목 검토
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {action.kind === "history" && (
        <>
          {(records.length > 0 || officeReview) && (
            <button onClick={exportHistory}>검토 기록 Markdown 저장</button>
          )}
          {undoSummary && <p role="status">{undoSummary}</p>}
          {[
            ...new Set(
              records.flatMap((record) =>
                record.group && record.state === "applied"
                  ? [record.group]
                  : [],
              ),
            ),
          ].map((group) => {
            const listed = records.filter(
              (record) => record.group === group && record.state === "applied",
            );
            return (
              listed.length > 1 && (
                <button
                  key={group}
                  disabled={saving}
                  onClick={() => void prepareBatchUndo(group)}
                >
                  여러 노트 되돌리기 · {listed.length}건 ·{" "}
                  {new Date(listed[0].date).toLocaleString()}
                </button>
              )
            );
          })}
          {batchUndo && (
            <section
              aria-label="여러 노트 되돌리기"
              className="application-results"
            >
              <strong>되돌릴 노트 선택</strong>
              {batchUndo.items.map((item) => (
                <div key={item.record.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={saving || !!item.problem}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBatchUndo({
                          ...batchUndo,
                          items: batchUndo.items.map((other) =>
                            other.record.id === item.record.id
                              ? { ...other, checked }
                              : other,
                          ),
                        });
                      }}
                    />
                    {item.record.title}
                  </label>
                  {item.problem ? (
                    <>
                      <small>{item.problem}</small>
                      <button
                        onClick={() => {
                          setBatchUndo(undefined);
                          void previewUndo(item.record);
                        }}
                      >
                        개별 검토
                      </button>
                    </>
                  ) : (
                    <details>
                      <summary>되돌리기 변경 보기</summary>
                      {diffLines(item.note!.body, item.body!, { timeout: 120 })
                        ?.filter((c) => c.added || c.removed)
                        .map((c, i) => (
                          <pre key={i} data-kind={c.added ? "add" : "remove"}>
                            {c.value}
                          </pre>
                        ))}
                    </details>
                  )}
                </div>
              ))}
              <button
                disabled={
                  saving || !batchUndo.items.some((item) => item.checked)
                }
                onClick={() => void applyBatchUndo()}
              >
                선택한 노트 되돌리기
              </button>
              <button disabled={saving} onClick={() => setBatchUndo(undefined)}>
                묶음 닫기
              </button>
            </section>
          )}
          {!records.length && <p>이 세션에서 반영한 노트가 없습니다.</p>}
          {records.map((record) => (
            <div className="application-row" key={record.id}>
              <span>
                {record.title} · 답변 {record.turn + 1} ·{" "}
                {new Date(record.date).toLocaleString()}
              </span>
              {record.state === "undone" ? (
                <small>되돌림</small>
              ) : (
                <button
                  disabled={saving}
                  onClick={() => void previewUndo(record)}
                >
                  되돌리기 미리보기
                </button>
              )}
            </div>
          ))}
          {undo && (
            <section>
              {undo.note.body !== undo.record.after && (
                <p>반영 후 원본이 수정되었습니다.</p>
              )}
              {undo.conflict && (
                <>
                  <p>
                    같은 위치가 편집되었습니다. 반영 전 내용을 참고해 되돌릴
                    내용을 직접 정하세요.
                  </p>
                  <pre>{undo.record.before}</pre>
                  <textarea
                    aria-label="되돌릴 내용"
                    value={undo.body}
                    onChange={(event) =>
                      setUndo({ ...undo, body: event.target.value })
                    }
                  />
                </>
              )}
              <div className="material-diff" aria-label="되돌리기 비교">
                {diffLines(undo.note.body, undo.body, { timeout: 120 })
                  ?.filter((c) => c.added || c.removed)
                  .map((c, i) => (
                    <pre key={i} data-kind={c.added ? "add" : "remove"}>
                      {c.value}
                    </pre>
                  ))}
              </div>
              <button
                disabled={saving || undo.note.body === undo.body}
                onClick={() => void confirmUndo()}
              >
                되돌리기 저장
              </button>
            </section>
          )}
        </>
      )}
      {!original && action.kind !== "history" && (
        <>
          <input
            aria-label="페이지 검색"
            autoFocus
            placeholder="페이지 이름 또는 경로 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(60);
            }}
          />
          <select
            aria-label="워크스페이스 페이지"
            value={id}
            onChange={(e) => {
              setNote(undefined);
              setConflictBase(undefined);
              setId(e.target.value);
            }}
          >
            <option value="">페이지 선택</option>
            {pages.slice(0, limit).map((n) => (
              <option key={n.id} value={n.id}>
                {n.path}
              </option>
            ))}
          </select>
          {pages.length > limit && (
            <button onClick={() => setLimit(limit + 60)}>더 보기</button>
          )}
        </>
      )}
      {note && selection?.kind === "sheets" && !original && (
        <div>
          <select
            aria-label="첨부할 시트"
            value={selection.sheet}
            onChange={(e) =>
              setSelection({ ...selection, sheet: e.target.value, range: "A1" })
            }
          >
            {workbook(note)?.sheets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            aria-label="첨부할 셀 범위"
            value={selection.range}
            onChange={(e) =>
              setSelection({ ...selection, range: e.target.value })
            }
          />
        </div>
      )}
      {note && selection?.kind === "architecture" && !original && (
        <select
          aria-label="첨부할 리소스"
          value={selection.resource}
          onChange={(e) =>
            setSelection({ ...selection, resource: e.target.value })
          }
        >
          {architecture(note)?.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label} · {n.address || n.kind}
            </option>
          ))}
        </select>
      )}
      {note && action.kind === "apply" && (
        <select
          aria-label="반영 위치"
          value={block}
          onChange={(e) => setBlock(Number(e.target.value))}
        >
          {block === -2 && (
            <option value={-2} disabled>
              최신본에서 반영 위치 선택
            </option>
          )}
          <option value={-1}>끝에 추가</option>
          {choices.map((b, i) => (
            <option key={b.start} value={i}>
              {i + 1}. {b.text.slice(0, 70)} · 블록 교체
            </option>
          ))}
        </select>
      )}
      {conflictBase && note && (
        <details open className="material-diff">
          <summary>검토 당시 원본과 최신본 비교</summary>
          {diffLines(conflictBase.body, note.body, { timeout: 120 })
            ?.filter((c) => c.added || c.removed)
            .map((c, i) => (
              <pre key={i} data-kind={c.added ? "add" : "remove"}>
                {c.value}
              </pre>
            ))}
        </details>
      )}
      {action.kind === "apply" && note && (
        <label>
          반영할 내용
          <textarea
            aria-label="반영할 내용"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </label>
      )}
      {action.kind === "apply" &&
        proposals.map((p) => (
          <details key={p.note.id} className="application-proposal">
            <summary>
              {p.note.title}
              {p.problem ? " · 재검토 필요" : ""}
            </summary>
            {p.problem && <p>{p.problem}</p>}
            <button disabled={saving} onClick={() => void revisit(p)}>
              {p.problem ? "최신본에서 재검토" : "대상과 내용 편집"}
            </button>
            <label>
              <input
                type="checkbox"
                checked={p.checked}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setProposals((list) =>
                    list.map((item) =>
                      item.note.id === p.note.id ? { ...item, checked } : item,
                    ),
                  );
                }}
              />
              이 변경 저장
            </label>
            <div className="material-diff">
              {diffLines(p.note.body, p.body, { timeout: 120 })?.map((c, i) => (
                <pre
                  key={i}
                  data-kind={c.added ? "add" : c.removed ? "remove" : "same"}
                >
                  {c.value}
                </pre>
              ))}
            </div>
            <button
              onClick={() =>
                setProposals((list) =>
                  list.filter((item) => item.note.id !== p.note.id),
                )
              }
            >
              목록에서 제거
            </button>
          </details>
        ))}
      {original && note && (
        <small>
          {original.workspace?.revision !== note.revision
            ? "원본 변경됨"
            : "같은 버전"}{" "}
          · {note.path}
        </small>
      )}
      {original && before === after && (
        <small>선택한 범위의 내용이 같습니다.</small>
      )}
      {before !== undefined && after !== undefined ? (
        <div className="material-diff" aria-label="변경 미리보기">
          {changes ? (
            changes.map((c, i) => (
              <pre
                key={i}
                data-kind={c.added ? "add" : c.removed ? "remove" : "same"}
              >
                {(c.added ? "+ " : c.removed ? "− " : "  ") + c.value}
              </pre>
            ))
          ) : (
            <>
              <pre>{before}</pre>
              <hr />
              <pre>{after}</pre>
            </>
          )}
        </div>
      ) : (
        preview.file && <pre>{preview.file.text}</pre>
      )}
      {(error || preview.error) && <p role="alert">{error || preview.error}</p>}
      <footer>
        {original && (
          <button
            onClick={() => {
              attach(original, original);
              close();
            }}
          >
            기존 사본 사용
          </button>
        )}
        {error && id && (
          <button onClick={() => setReload((n) => n + 1)}>다시 불러오기</button>
        )}
        {action.kind === "apply" &&
          (id || proposals.length > 0 || answer !== action.answer) && (
            <button
              disabled={saving}
              onClick={() => {
                void persist()
                  .then(close)
                  .catch((e) => setError(String(e)));
              }}
            >
              검토 초안 삭제
            </button>
          )}
        {action.kind === "apply" && note && (
          <button
            disabled={saving || block === -2 || !answer.trim()}
            onClick={() => stage(note)}
          >
            검토 목록에 추가
          </button>
        )}
        {action.kind !== "history" && (
          <button
            disabled={
              saving ||
              (action.kind === "apply"
                ? proposals.length
                  ? !!note || !proposals.some((p) => p.checked && !p.problem)
                  : !(note && block !== -2 && answer.trim())
                : !preview.file)
            }
            onClick={() => void saveSelection()}
          >
            {action.kind === "apply"
              ? proposals.length
                ? "선택한 변경 저장"
                : "변경 저장"
              : original
                ? "최신 사본 사용"
                : "선택한 자료 첨부"}
          </button>
        )}
      </footer>
    </dialog>
  );
}
