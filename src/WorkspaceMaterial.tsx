import { useEffect, useMemo, useRef, useState } from "react";
import { diffLines, applyPatch, createPatch } from "diff";
import {
  readNoteApplications,
  saveNoteApplication,
  removeNoteApplication,
  type NoteApplication,
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
  | { kind: "apply"; answer: string; turn: number }
  | { kind: "history" };
type Proposal = { note: Note; body: string; checked: boolean };
export default function WorkspaceMaterial({
  access,
  action,
  close,
  attach,
  sessionKey,
}: {
  access: WorkspaceAccess;
  sessionKey: string;
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
    action.kind === "apply" ? action.answer : "",
  );
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [records, setRecords] = useState<NoteApplication[]>([]);
  const [undo, setUndo] = useState<{
    record: NoteApplication;
    note: Note;
    body: string;
    conflict: boolean;
  }>();
  const [id, setId] = useState(original?.workspace?.page || "");
  const [note, setNote] = useState<Note>(),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Selection | undefined>(
    original?.workspace?.selection,
  );
  const [block, setBlock] = useState(-1),
    [reload, setReload] = useState(0);
  const read = useRef(access.read);
  read.current = access.read;
  useEffect(() => {
    dialog.current?.showModal();
    if (action.kind === "history")
      void readNoteApplications(sessionKey)
        .then((list) =>
          setRecords(list.sort((a, b) => b.date.localeCompare(a.date))),
        )
        .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    let live = true;
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
  function stage(note: Note) {
    setProposals((current) => [
      ...current.filter((p) => p.note.id !== note.id),
      { note, body: nextBody, checked: true },
    ]);
    setId("");
    setAnswer(action.kind === "apply" ? action.answer : "");
  }
  async function apply(p: Proposal) {
    if (action.kind !== "apply" || p.note.body === p.body) return;
    const record: NoteApplication = {
      id: crypto.randomUUID(),
      turn: action.turn,
      title: p.note.title,
      page: p.note.id,
      date: new Date().toISOString(),
      before: p.note.body,
      after: p.body,
      state: "pending",
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
        const checked = proposals.filter((p) => p.checked);
        for (const p of checked) {
          await apply(p);
          setProposals((items) =>
            items.filter((item) => item.note.id !== p.note.id),
          );
        }
        if (!proposals.length && note && answer.trim())
          await apply({ note, body: nextBody, checked: true });
        if (proposals.some((p) => !p.checked)) {
          setId("");
          return;
        }
      } else if (preview.file) attach(preview.file, original);
      close();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
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
        if (!saving) close();
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
        <button disabled={saving} onClick={close}>
          닫기
        </button>
      </header>
      {action.kind === "history" && (
        <>
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
          <option value={-1}>끝에 추가</option>
          {choices.map((b, i) => (
            <option key={b.start} value={i}>
              {i + 1}. {b.text.slice(0, 70)} · 블록 교체
            </option>
          ))}
        </select>
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
            <summary>{p.note.title}</summary>
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
        {action.kind === "apply" && note && (
          <button
            disabled={saving || !answer.trim()}
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
                  ? !!note || !proposals.some((p) => p.checked)
                  : !(note && answer.trim())
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
