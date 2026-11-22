import {
  downloadReview,
  officeReviewMarkdown,
  reviewValue,
  type FieldReview,type OfficeOutput,officeOutputHash,
} from "./review-export";
import {
  readOfficeReview,
  writeOfficeReview,
  readOfficeDraft,
  writeOfficeDraft,
  type OfficeDraft,
} from "./xcode-checkpoint";
import { compareOfficeValue } from "./office-value";
import { useEffect, useRef, useState } from "react";
import { resolveCitation } from "./AnswerSources";
import type { InputFile } from "./xcode-session";
import { api } from "./api";
import { formInstruction, inspectForm } from "./office-form";

type Form = Awaited<ReturnType<typeof inspectForm>>;
export default function OfficeForm({
  form,
  setForm,
  review,
  disabled,
  sessionKey,
  answer,
  answerFiles,
  prepare,
  close,
}: {
  form?: Form;
  sessionKey: string;
  setForm: (value?: Form) => void;
  review?: { text: string; id: string; files?: InputFile[] };
  close: () => void;
  disabled: boolean;
  answer: string;
  answerFiles: InputFile[];
  prepare: (text: string) => void;
}) {
  const [draft, setDraft] = useState("{}"),
    [notice, setNotice] = useState(""),
    [working, setWorking] = useState(false);
  const generation = useRef(0);
  const [ready, setReady] = useState("");
  const [originalChange, setOriginalChange] = useState<OfficeDraft>();
  const [responseId, setResponseId] = useState<string>();
  const [verification, setVerification] =
    useState<ReturnType<Form["verify"]>>();
  const draftWrite = useRef<Promise<unknown>>(Promise.resolve());
  const [preview, setPreview] = useState<FieldReview[]>();
  const reviewPanel = useRef<HTMLDivElement>(null);
  const lastChanges = useRef<Promise<unknown>>(Promise.resolve());
  function persistReview(fields: FieldReview[], archive = false,output?:OfficeOutput) {
    if (!form) return Promise.resolve();
    const snapshot = {
      form: form.name,
      identity: form.identity,
      reviewedAt: new Date().toISOString(),
      fields,output,
    };
    lastChanges.current = lastChanges.current
      .catch(() => {})
      .then(() => writeOfficeReview(sessionKey, snapshot, archive));
    return lastChanges.current;
  }
  function updateReview(fields: FieldReview[]) {
    setPreview(fields);
    void persistReview(fields).catch((err) => setNotice(String(err)));
  }
  const [sources, setSources] = useState<Record<string, string[]>>({});
  const [reviewFiles, setReviewFiles] = useState<InputFile[]>([]);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const citations = (id: string) =>
    (sources[id] || []).flatMap((ref) => {
      const label = ref
        .trim()
        .replace(/^\[|\]$/g, "")
        .replace(/\s+·\s+/, "#");
      return resolveCitation(reviewFiles, label) || [];
    });
  const verified = (id: string) => citations(id).length > 0;
  function evidence(id: string) {
    const hits = citations(id);
    const proposed = proposedValue(id);
    return hits.length ? (
      <details>
        <summary>
          {hits.map((hit) => hit.label.replace("#", " · ")).join(" · ")}
        </summary>
        {hits.map((hit) => (
          <div className="office-value-compare" key={hit.label}>
            {proposed !== undefined && (
              <div>
                <small>제안 값</small>
                <p>{String(proposed)}</p>
              </div>
            )}
            <div>
              <small>출처 값</small>
              <pre>{hit.value}</pre>
            </div>
            {compareOfficeValue(proposed, hit.value) && (
              <small>{compareOfficeValue(proposed, hit.value)}</small>
            )}
          </div>
        ))}
      </details>
    ) : sources[id]?.length ? (
      <small>
        {sources[id].join(" · ")}
        {sources[id][0] !== "직접 입력" ? " · 근거 확인 필요" : ""}
      </small>
    ) : (
      <small>연결된 근거 없음</small>
    );
  }
  const [values, setValues] = useState<
    Record<string, string | number | boolean>
  >({});
  async function load(file?: File) {
    const token = ++generation.current;
    setNotice("");
    if (!file) return;
    try {
      await draftWrite.current;
    } catch (err) {
      setNotice(String(err));
      return;
    }
    try {
      const result = await inspectForm(file);
      if (token === generation.current) {
        setForm(result);
      }
    } catch (e) {
      if (token === generation.current) setNotice(String(e));
    }
  }
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<string[]>([]);
  function restore(draft: OfficeDraft) {
    setValues(draft.values);
    setDraft(draft.json);
    setSources(draft.sources);
    setReviewFiles(draft.files);
    setConflicts(draft.conflicts);
    setAccepted(draft.accepted);
    setPreview(draft.preview);
    setResponseId(draft.responseId);
  }
  useEffect(() => {
    let current = true;
    setReady("");
    setOriginalChange(undefined);
    setVerification(undefined);
    setValues({});
    setSources({});
    setReviewFiles([]);
    setConflicts({});
    setAccepted([]);
    setResponseId(undefined);
    setDraft("{}");
    setPreview(undefined);
    if (!form) return;
    void Promise.all([readOfficeDraft(sessionKey,form.identity),readOfficeReview(sessionKey)])
      .then(([{exact,previous},legacy])=>{
        if(!current)return;
        if(exact)restore(exact);
        else if(legacy?.identity===form.identity && !review){
          const preview=legacy.fields;
          const values=Object.fromEntries(preview.flatMap(field=>
            typeof field.value==="string" || typeof field.value==="number" || typeof field.value==="boolean"
              ? [[field.id,field.value]] : []));
          restore({identity:form.identity,form:form.name,advanced:form.advanced,fields:form.fields,values,
            json:JSON.stringify(Object.fromEntries(preview.filter(field=>field.value!==undefined).map(field=>[field.id,field.value])),null,2),
            preview,sources:Object.fromEntries(preview.map(field=>[field.id,field.sources])),
            files:answerFiles,conflicts:{},accepted:preview.filter(field=>field.included && field.id.includes("#blank")).map(field=>field.id)});
        }else if(previous?.form===form.name)setOriginalChange(previous);
        setReady(form.identity);
      })
      .catch((err) => {
        if (current) setNotice("검토 초안을 읽을 수 없습니다. " + String(err));
      });
    return () => {
      current = false;
    };
  }, [form?.identity, sessionKey]);
  useEffect(() => {
    if (!form || ready !== form.identity || originalChange) return;
    if (review && review.id !== responseId) {
      applyAnswer(review.text, review.files || [], review.id);
      return;
    }
    const snapshot: OfficeDraft = {
      form: form.name,
      identity: form.identity,
      advanced: form.advanced,
      fields: form.fields,
      values,
      json: draft,
      preview,
      sources,
      files: reviewFiles,
      conflicts,
      accepted,
      responseId,
    };
    draftWrite.current = draftWrite.current
      .catch(() => {})
      .then(() => writeOfficeDraft(sessionKey, snapshot));
    void draftWrite.current.catch((err) =>
      setNotice("검토 초안을 저장하지 못했습니다. " + String(err)),
    );
  }, [
    ready,
    originalChange,
    form?.identity,
    sessionKey,
    review?.id,
    responseId,
    values,
    draft,
    preview,
    sources,
    reviewFiles,
    conflicts,
    accepted,
  ]);
  function compareTemplate(older: OfficeDraft, newer: Form) {
    const before = new Map(older.fields.map((field) => [field.id, field]));
    const after = new Map(newer.fields.map((field) => [field.id, field]));
    const stable = new Set(
      newer.fields
        .filter((field) => {
          const old = before.get(field.id);
          return (
            !older.advanced &&
            !newer.advanced &&
            old?.label === field.label &&
            old.original === field.original
          );
        })
        .map((field) => field.id),
    );
    return {
      stable,
      added: newer.fields.filter((field) => !before.has(field.id)),
      removed: older.fields.filter((field) => !after.has(field.id)),
      changed: newer.fields.filter(
        (field) => before.has(field.id) && !stable.has(field.id),
      ),
    };
  }
  function adoptTemplate() {
    if (!form || !originalChange) return;
    const { stable } = compareTemplate(originalChange, form);
    const keep = <T,>(record: Record<string, T>) =>
      Object.fromEntries(
        Object.entries(record).filter(([id]) => stable.has(id)),
      );
    restore({
      ...originalChange,
      identity: form.identity,
      fields: form.fields,
      advanced: form.advanced,
      values: keep(originalChange.values),
      json: "{}",
      sources: keep(originalChange.sources),
      conflicts: keep(originalChange.conflicts),
      accepted: originalChange.accepted.filter((id) => stable.has(id)),
      preview:
        originalChange.preview && !form.advanced
          ? form.fields.map((field) => {
              const old = originalChange!.preview!.find(
                (entry) => entry.id === field.id,
              );
              return old && stable.has(field.id)
                ? { ...old, ...field }
                : {
                    ...field,
                    value: undefined,
                    included: false,
                    approved: false,
                    reason: "",
                    sources: [],
                  };
            })
          : undefined,
      responseId: review?.id,
    });
    setOriginalChange(undefined);
  }
  function applyAnswer(text: string, files = answerFiles, id = review?.id) {
    setResponseId(id);
    setPreview(undefined);
    try {
      const block =
        text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i)?.[1] ?? text;
      const data = JSON.parse(block);
      if (
        !data.values ||
        Array.isArray(data.values) ||
        typeof data.values !== "object"
      )
        throw Error("values 객체가 필요합니다.");
      setConflicts(
        Object.fromEntries(
          Object.entries(data.conflicts || {}).filter(
            (e): e is [string, string] => typeof e[1] === "string",
          ),
        ),
      );
      if (form?.advanced) setDraft(JSON.stringify(data.values, null, 2));
      else {
        const next: typeof values = {};
        for (const { id } of form?.fields || []) {
          const v = data.values[id];
          if (
            !Object.hasOwn(data.conflicts || {}, id) &&
            ["string", "boolean", "number"].includes(typeof v)
          )
            next[id] = v;
        }
        setValues(next);
      }
      setReviewFiles(files);
      setIssuesOnly(false);
      setSources(
        Object.fromEntries(
          Object.entries(data.sources || {}).flatMap(([id, refs]) => {
            const list = (Array.isArray(refs) ? refs : [refs]).filter(
              (v): v is string => typeof v === "string",
            );
            return list.length ? [[id, [...new Set(list)]]] : [];
          }),
        ),
      );
      setNotice("제안 값과 출처를 확인하세요.");
    } catch {
      setNotice(
        "답변의 JSON을 읽을 수 없습니다. 작성 요청을 다시 보내거나 값을 직접 입력하세요.",
      );
    }
  }
  let advancedValues: Record<string, unknown> = {};
  if (form?.advanced) {
    try {
      advancedValues = JSON.parse(draft) || {};
    } catch {
      /* The JSON editor reports invalid input on save. */
    }
  }
  const advancedKeys = Object.keys(advancedValues);
  function proposedValue(id: string) {
    return form?.advanced ? advancedValues[id] : values[id];
  }
  function needsReview(id: string) {
    return Boolean(
      conflicts[id] ||
      proposedValue(id) === undefined ||
      !verified(id) ||
      citations(id).some((hit) =>
        compareOfficeValue(proposedValue(id), hit.value),
      ),
    );
  }
  async function openPreview() {
    if (!form) return;
    try {
      const advanced = form.advanced ? JSON.parse(draft) : undefined;
      if (
        form.advanced &&
        (!advanced || Array.isArray(advanced) || typeof advanced !== "object")
      )
        throw Error("반복 행·조건 데이터는 JSON 객체여야 합니다.");
      const fields = form.advanced
        ? Object.keys(advanced).map((id) => ({ id, label: id, original: "" }))
        : form.fields;
      const stored = await readOfficeReview(sessionKey);
      const saved =
        stored?.identity === form.identity
          ? new Map(stored.fields.map((item) => [item.id, item]))
          : new Map<string, FieldReview>();
      const listed = fields.map((field) => {
        const value = form.advanced ? advanced[field.id] : values[field.id];
        const refs = sources[field.id] || [];
        const previous = saved.get(field.id);
        const same =
          previous &&
          JSON.stringify(previous.value) === JSON.stringify(value) &&
          JSON.stringify(previous.sources) === JSON.stringify(refs);
        return {
          ...field,
          value,
          sources: refs,
          included: same
            ? previous.included
            : value !== undefined &&
              value !== "" &&
              (!field.id.includes("#blank") || accepted.includes(field.id)),
          approved: same ? previous.approved : false,
          reason: same ? previous.reason : "",
        };
      });
      setPreview(listed);
      setNotice("");
      requestAnimationFrame(() =>
        reviewPanel.current?.scrollIntoView({ block: "nearest" }),
      );
    } catch (err) {
      setNotice(String(err));
    }
  }
  function selectedFields(fields: FieldReview[]) {
    return Object.fromEntries(
      fields
        .filter(
          (field) =>
            field.included && field.value !== undefined && field.value !== "",
        )
        .map((field) => [field.id, field.value]),
    );
  }
  async function inspectCopy(file?: File) {
    if (!form || !file || !preview) return;
    if (file.size > 32 * 1024 * 1024) {
      setNotice("32MB 이하 작성본을 선택하세요.");
      return;
    }
    try {
      setVerification(
        form.verify(
          new Uint8Array(await file.arrayBuffer()),
          selectedFields(preview) as typeof values,
        ),
      );
    } catch (err) {
      setNotice(String(err));
    }
  }
  async function save() {
    if (!form || !preview) return;
    setWorking(true);
    setNotice("");
    try {
      const selected = selectedFields(preview);
      await persistReview(preview);
      const data = form.advanced
        ? await api.renderWordTemplate?.(form.bytes, selected)
        : form.render(selected as typeof values);
      if (data === null) {
        setNotice("설치를 취소했습니다.");
        return;
      }
      if (!data) throw Error("고급 Word 양식은 데스크톱 앱에서 저장하세요.");
      const result = form.verify(data, selected as typeof values);
      setVerification(result);
      if (result.issues.length) {
        setNotice("검사에서 불일치가 발견되어 작성본 저장을 중단했습니다.");
        return;
      }
      const filename=form.name.replace(/(\.[^.]+)$/, "-작성본$1");
      if(api.saveOfficeCopy){
        const sha256=await officeOutputHash(data);
        const receipt=await api.saveOfficeCopy({filename,bytes:new Uint8Array(data)});
        if(!receipt){setNotice("작성본 저장을 취소했습니다.");return;}
        await persistReview(preview,true,{...receipt,sha256,bytes:data.byteLength,fields:result.total,
          formulas:result.formulaCount,status:result.structureOnly?"structure":"verified"});
        setNotice("작성본을 저장하고 검토 이력에 기록했습니다.");
        return;
      }
      await persistReview(preview,true);
      const url = URL.createObjectURL(new Blob([new Uint8Array(data)]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice("작성본 다운로드를 요청했습니다.");
    } catch (e) {
      setNotice(String(e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="office-form" aria-label="Word·Excel 양식 채우기">
      <header>
        <strong>Word·Excel 양식 채우기</strong>
        <button
          onClick={() =>
            void draftWrite.current
              .then(close)
              .catch((err) => setNotice(String(err)))
          }
          aria-label="양식 패널 닫기"
        >
          닫기
        </button>
      </header>
      <fieldset disabled={disabled || working}>
        <label>
          원본 양식
          <input
            type="file"
            accept=".docx,.xlsx"
            onChange={(e) => void load(e.target.files?.[0])}
          />
        </label>
        {form &&
          originalChange &&
          (() => {
            const delta = compareTemplate(originalChange, form);
            return (
              <section
                className="office-origin-change"
                aria-label="원본 양식 변경"
              >
                <strong>원본 양식이 변경되었습니다.</strong>
                <p>
                  추가 {delta.added.length} · 삭제 {delta.removed.length} ·
                  재검토 {delta.changed.length} · 재사용 가능{" "}
                  {delta.stable.size}
                </p>
                <ul>
                  {[
                    ...delta.added.map((f) => "추가 · " + f.label),
                    ...delta.removed.map((f) => "삭제 · " + f.label),
                    ...delta.changed.map((f) => "재검토 · " + f.label),
                    ...form.fields
                      .filter((f) => delta.stable.has(f.id))
                      .map((f) => "재사용 · " + f.label),
                  ].map((label, i) => (
                    <li key={i}>{label}</li>
                  ))}
                </ul>
                <button onClick={adoptTemplate}>
                  일치하는 입력란의 검토 복구
                </button>
                <button onClick={() => setOriginalChange(undefined)}>
                  새 원본으로 시작
                </button>
              </section>
            );
          })()}
        {form && ready === form.identity && !originalChange && (
          <>
            <strong>{form.name}</strong>
            <p>근거 자료를 채팅에 첨부한 뒤 작성 요청을 보내세요.</p>
            <div className="form-actions">
              <button onClick={() => prepare(formInstruction(form))}>
                작성 요청을 입력창에 추가
              </button>
              <button disabled={!answer} onClick={() => applyAnswer(answer)}>
                최근 답변으로 채우기
              </button>
            </div>
            <label className="office-source-filter">
              <input
                type="checkbox"
                checked={issuesOnly}
                onChange={(e) => setIssuesOnly(e.target.checked)}
              />
              근거 누락·충돌만 보기
            </label>
            {form.advanced ? (
              <>
                <label>
                  반복 행·조건 데이터 (JSON)
                  <textarea
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setPreview(undefined);
                    }}
                  />
                </label>
                <small>
                  고급 Word 양식은 저장할 때 로컬 python-docx-template를
                  사용합니다.
                </small>
                {Object.entries(conflicts).map(([id, value]) => (
                  <small key={id}>
                    {id} · 근거 충돌 · {value}
                  </small>
                ))}
                {[
                  ...new Set([
                    ...Object.keys(sources),
                    ...Object.keys(conflicts),
                    ...advancedKeys,
                  ]),
                ]
                  .filter((id) => !issuesOnly || needsReview(id))
                  .map((id) => (
                    <div key={id}>
                      <small>{id}</small>
                      {evidence(id)}
                    </div>
                  ))}
              </>
            ) : (
              <div>
                {Array.from(
                  { length: Math.ceil(form.fields.length / 8) },
                  (_, group) => {
                    const inputs = form.fields
                      .slice(group * 8, group * 8 + 8)
                      .filter(({ id }) => !issuesOnly || needsReview(id))
                      .map(({ id, label }) => (
                        <div key={id} className="office-source-field">
                          <label>
                            {label}
                            {id.includes("#blank") && (
                              <input
                                type="checkbox"
                                aria-label={label + " 밑줄 사용"}
                                checked={accepted.includes(id)}
                                onChange={(e) => {
                                  setPreview(undefined);
                                  setAccepted((prev) =>
                                    e.target.checked
                                      ? [...prev, id]
                                      : prev.filter((k) => k !== id),
                                  );
                                }}
                              />
                            )}
                            {id !== label && <small>{id}</small>}
                            <input
                              value={String(values[id] ?? "")}
                              placeholder="확인 필요"
                              onChange={(e) => {
                                setPreview(undefined);
                                const raw = e.target.value;
                                setValues({
                                  ...values,
                                  [id]:
                                    form.name.endsWith(".xlsx") &&
                                    /^-?(0|[1-9]\d*)(\.\d+)?$/.test(raw)
                                      ? Number(raw)
                                      : raw,
                                });
                                // Keep cited evidence available when the proposed value is corrected.
                              }}
                            />
                            {conflicts[id] && (
                              <small>근거 충돌 · {conflicts[id]}</small>
                            )}
                            {values[id] === undefined && <small>값 누락</small>}
                          </label>
                          {citations(id).some((hit) =>
                            compareOfficeValue(proposedValue(id), hit.value),
                          ) && (
                            <small className="office-compare-status">
                              출처와 값 대조 필요
                            </small>
                          )}
                          {evidence(id)}
                        </div>
                      ));
                    if (!inputs.length) return null;
                    const fields = (
                      <div key={group} className="form-fields">
                        {inputs}
                      </div>
                    );
                    return form.fields.length <= 8 ? (
                      fields
                    ) : (
                      <details key={group} open={issuesOnly || group === 0}>
                        <summary>
                          양식 항목 {group * 8 + 1}–
                          {Math.min(group * 8 + 8, form.fields.length)}
                        </summary>
                        {fields}
                      </details>
                    );
                  },
                )}
              </div>
            )}
            <button onClick={() => void openPreview()}>저장 전 미리보기</button>
            {preview && (
              <div
                ref={reviewPanel}
                className="office-save-review"
                role="region"
                aria-label="작성본 미리보기"
              >
                <header>
                  <strong>작성본 미리보기</strong>
                  <button onClick={() => setPreview(undefined)}>닫기</button>
                </header>
                <div className="office-preview-fields">
                  {preview.map((field) => {
                    const patch = (next: Partial<FieldReview>) =>
                      updateReview(
                        preview.map((item) =>
                          item.id === field.id ? { ...item, ...next } : item,
                        ),
                      );
                    const hasValue =
                      field.value !== undefined && field.value !== "";
                    return (
                      <section key={field.id}>
                        <strong>{field.label}</strong>
                        <div className="office-value-compare">
                          <div>
                            <small>
                              {form.advanced ? "양식 변수" : "원본 값"}
                            </small>
                            <pre>
                              {field.original ||
                                (form.advanced ? field.id : "(빈 값)")}
                            </pre>
                          </div>
                          <div>
                            <small>제안 값</small>
                            <pre>{reviewValue(field.value) || "(빈 값)"}</pre>
                          </div>
                        </div>
                        {evidence(field.id)}
                        {conflicts[field.id] && (
                          <p>근거 충돌 · {conflicts[field.id]}</p>
                        )}
                        <label>
                          <input
                            type="checkbox"
                            checked={field.included}
                            disabled={!hasValue}
                            onChange={(e) =>
                              patch({ included: e.target.checked })
                            }
                          />
                          반영
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={field.approved}
                            onChange={(e) =>
                              patch({ approved: e.target.checked })
                            }
                          />
                          검토 승인
                        </label>
                        <label>
                          수정·승인 사유
                          <input
                            aria-label={field.label + " 검토 사유"}
                            value={field.reason}
                            onChange={(e) => patch({ reason: e.target.value })}
                          />
                        </label>
                      </section>
                    );
                  })}
                </div>
                <label>
                  저장한 작성본 검사
                  <input
                    type="file"
                    accept=".docx,.xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void inspectCopy(file);
                    }}
                  />
                </label>
                {verification && (
                  <section
                    aria-label="작성본 검사 결과"
                    className="office-copy-check"
                  >
                    <strong>
                      {verification.issues.length
                        ? "작성본 검사 불일치"
                        : verification.structureOnly
                          ? "고급 Word 작성본 구조 확인"
                          : "작성본 검사 통과"}
                    </strong>
                    {verification.structureOnly ? (
                      <small>반복·조건 양식은 문서 구조를 확인했습니다.</small>
                    ) : (
                      <small>
                        반영 {verification.copied}개 · 입력 위치{" "}
                        {verification.total}개 · 수식{" "}
                        {verification.formulaCount}개 비교
                      </small>
                    )}
                    {verification.issues.length > 0 && (
                      <ul>
                        {verification.issues.slice(0, 50).map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
                <footer>
                  <button
                    onClick={() =>
                      void persistReview(preview, true)
                        .then(() =>
                          downloadReview(
                            "Office-검토-기록",
                            officeReviewMarkdown({
                              form: form.name,
                              identity: form.identity,
                              reviewedAt: new Date().toISOString(),
                              fields: preview,
                            }),
                          ),
                        )
                        .catch((err) => setNotice(String(err)))
                    }
                  >
                    검토 기록 Markdown 저장
                  </button>
                  <button
                    disabled={!preview.some((field) => field.included)}
                    onClick={() => void save()}
                  >
                    작성본 사본 저장
                  </button>
                </footer>
              </div>
            )}
          </>
        )}
      </fieldset>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
