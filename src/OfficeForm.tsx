import { useEffect, useRef, useState } from "react";
import {resolveCitation} from "./AnswerSources";
import type {InputFile} from "./xcode-session";
import { api } from "./api";
import { formInstruction, inspectForm } from "./office-form";

type Form = Awaited<ReturnType<typeof inspectForm>>;
export default function OfficeForm({
  form, setForm, review, disabled,
  answer,answerFiles,
  prepare,
  close,
}: {
  form?: Form;
  setForm: (value?: Form) => void;
  review?: {text:string;id:string;files?:InputFile[]};
  close: () => void;
  disabled: boolean;
  answer: string;
  answerFiles:InputFile[];
  prepare: (text: string) => void;
}) {
  const [draft, setDraft] = useState("{}"),
    [notice, setNotice] = useState(""),
    [working, setWorking] = useState(false);
  const generation = useRef(0);
  const [sources, setSources] = useState<Record<string, string[]>>({});
  const [reviewFiles,setReviewFiles]=useState<InputFile[]>([]);
  const [issuesOnly,setIssuesOnly]=useState(false);
  const citations=(id:string)=> (sources[id] || []).flatMap(ref=>{
    const label=ref.trim().replace(/^\[|\]$/g,"").replace(/\s+·\s+/,"#");
    return resolveCitation(reviewFiles,label) || [];
  });
  const verified=(id:string)=>citations(id).length>0;
  function evidence(id:string){
    const hits=citations(id);
    return hits.length ? <details><summary>{hits.map(hit=>hit.label.replace("#"," · ")).join(" · ")}</summary>
      {hits.map(hit=><pre key={hit.label}>{hit.value}</pre>)}</details> : sources[id]?.length?<small>{sources[id].join(" · ")}{sources[id][0]!=="직접 입력"?" · 근거 확인 필요":""}</small>:<small>연결된 근거 없음</small>;
  }
  const [values, setValues] = useState<
    Record<string, string | number | boolean>
  >({});
  async function load(file?: File) {
    const token = ++generation.current;
    setForm(undefined);
    setNotice("");
    setDraft("");
    setSources({});
    setValues({});
    if (!file) return;
    try {
      const result = await inspectForm(file);
      if (token === generation.current) {
        setForm(result);
        setDraft("{}");
      }
    } catch (e) {
      if (token === generation.current) setNotice(String(e));
    }
  }
  const [conflicts, setConflicts] = useState<Record<string,string>>({});
  const [accepted, setAccepted] = useState<string[]>([]);
  useEffect(() => {
    setValues({}); setSources({}); setConflicts({}); setAccepted([]); setDraft("{}"); setNotice("");
  }, [form]);
  useEffect(() => { if (review && form) applyAnswer(review.text,review.files || []); }, [review, form]);
  function applyAnswer(text: string,files=answerFiles) {
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
      setConflicts(Object.fromEntries(Object.entries(data.conflicts || {}).filter((e): e is [string,string] => typeof e[1] === "string")));
      if (form?.advanced) setDraft(JSON.stringify(data.values, null, 2));
      else {
        const next: typeof values = {};
        for (const { id } of form?.fields || []) {
          const v = data.values[id];
          if (!Object.hasOwn(data.conflicts || {}, id) && ["string", "boolean", "number"].includes(typeof v)) next[id] = v;
        }
        setValues(next);
      }
      setReviewFiles(files);setIssuesOnly(false);
      setSources(Object.fromEntries(Object.entries(data.sources || {}).flatMap(([id,refs])=>{
        const list=(Array.isArray(refs)?refs:[refs]).filter((v):v is string=>typeof v==="string");
        return list.length?[[id,[...new Set(list)]]]:[];
      })));
      setNotice("제안 값과 출처를 확인하세요.");
    } catch {
      setNotice(
        "답변의 JSON을 읽을 수 없습니다. 작성 요청을 다시 보내거나 값을 직접 입력하세요.",
      );
    }
  }
  let advancedKeys:string[]=[];
  if(form?.advanced){
    try{advancedKeys=Object.keys(JSON.parse(draft));}catch{ /* The JSON editor reports invalid input on save. */ }
  }
  async function save() {
    if (!form) return;
    setWorking(true);
    setNotice("");
    try {
      const data = form.advanced
        ? await api.renderWordTemplate?.(form.bytes, JSON.parse(draft))
        : form.render(Object.fromEntries(Object.entries(values).filter(([id]) => !id.includes("#blank") || accepted.includes(id))));
      if (data === null) {
        setNotice("설치를 취소했습니다.");
        return;
      }
      if (!data) throw Error("고급 Word 양식은 데스크톱 앱에서 저장하세요.");
      const url = URL.createObjectURL(new Blob([new Uint8Array(data)]));
      const a = document.createElement("a");
      a.href = url;
      a.download = form.name.replace(/(\.[^.]+)$/, "-작성본$1");
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
      <header><strong>Word·Excel 양식 채우기</strong><button onClick={close} aria-label="양식 패널 닫기">닫기</button></header>
      <fieldset disabled={disabled || working}>
        <label>
          원본 양식
          <input
            type="file"
            accept=".docx,.xlsx"
            onChange={(e) => void load(e.target.files?.[0])}
          />
        </label>
        {form && (
          <>
            <strong>{form.name}</strong><p>근거 자료를 채팅에 첨부한 뒤 작성 요청을 보내세요.</p>
            <div className="form-actions">
              <button
                onClick={() =>
                  prepare(
                    formInstruction(form),
                  )
                }
              >
                작성 요청을 입력창에 추가
              </button>
              <button disabled={!answer} onClick={()=>applyAnswer(answer)}>
                최근 답변으로 채우기
              </button>
            </div>
            <label className="office-source-filter"><input type="checkbox" checked={issuesOnly} onChange={e=>setIssuesOnly(e.target.checked)}/>근거 누락·충돌만 보기</label>
            {form.advanced ? (
              <>
                <label>
                  반복 행·조건 데이터 (JSON)
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </label>
                <small>
                  고급 Word 양식은 저장할 때 로컬 python-docx-template를
                  사용합니다.
                </small>
                {Object.entries(conflicts).map(([id, value]) => <small key={id}>{id} · 근거 충돌 · {value}</small>)}
                {[...new Set([...Object.keys(sources),...Object.keys(conflicts),...advancedKeys])].filter(id=>!issuesOnly || conflicts[id] || !verified(id)).map(id=>
                  <div key={id}><small>{id}</small>{evidence(id)}</div>)}
              </>
            ) : (
              <div>
                {Array.from({length:Math.ceil(form.fields.length/8)},(_,group)=>{
                  const inputs = form.fields.slice(group*8,group*8+8).filter(({id})=>!issuesOnly || conflicts[id] || values[id]===undefined || !verified(id)).map(({ id, label }) => (
                  <div key={id} className="office-source-field"><label>
                    {label}
                    {id.includes("#blank") && <input type="checkbox" aria-label={label+" 밑줄 사용"} checked={accepted.includes(id)} onChange={e => setAccepted(prev => e.target.checked ? [...prev,id] : prev.filter(k=>k!==id))}/>}
                    {id !== label && <small>{id}</small>}
                    <input
                      value={String(values[id] ?? "")}
                      placeholder="확인 필요"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setValues({
                          ...values,
                          [id]:
                            form.name.endsWith(".xlsx") &&
                            /^-?(0|[1-9]\d*)(\.\d+)?$/.test(raw)
                              ? Number(raw)
                              : raw,
                        });
                        setSources({ ...sources, [id]: ["직접 입력"] });
                      }}
                    />
                    {conflicts[id] && <small>근거 충돌 · {conflicts[id]}</small>}
                    {values[id] === undefined && <small>값 누락</small>}
                  </label>{evidence(id)}</div>
                  ));
                  if(!inputs.length) return null;
                  const fields=<div key={group} className="form-fields">{inputs}</div>;
                  return form.fields.length<=8 ? fields : <details key={group} open={issuesOnly || group===0}>
                    <summary>양식 항목 {group*8+1}–{Math.min(group*8+8,form.fields.length)}</summary>{fields}
                  </details>;
                })}
              </div>
            )}
            <button onClick={() => void save()}>작성본 사본 저장</button>
          </>
        )}
      </fieldset>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
