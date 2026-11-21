import AnswerSources from "./AnswerSources";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, Copy, History, Terminal, Search, MoreHorizontal } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { validHarness, type Harness, type Turn } from "./xcode-session";

export type PendingMessage = { prompt: string; files: string[]; index: number };

const Answer = memo(function Answer({ text }: { text: string }) {
  const html = useMemo(
    () =>
      DOMPurify.sanitize(marked.parse(text, { async: false }) as string, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "strong",
          "em",
          "del",
          "code",
          "pre",
          "blockquote",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "hr",
          "a",
        ],
        ALLOWED_ATTR: ["href", "title", "start"],
        ALLOWED_URI_REGEXP: /^https?:\/\//i,
      }),
    [text],
  );
  return (
    <div role="group" aria-label="모델 답변" className="chat-answer" dangerouslySetInnerHTML={{ __html: html }} />
  );
});

function Question({ prompt, files }: { prompt: string; files: string[] }) {
  return (
    <div className="chat-question" aria-label="내 메시지">
      {prompt && <p>{prompt}</p>}
      {files.length > 0 && <small>{files.join(" · ")}</small>}
    </div>
  );
}

export default function ChatTimeline({
  turns,
  reading,
  pending,
  preview,
  phase,
  busy,
  error,
  readonly,
  applyHarness, onQuote, folders, defaultFolder, savePage,
}: {
  reading: { top:number; follow:boolean };
  turns: Turn[];
  pending: PendingMessage | null;
  preview: string;
  phase: string;
  busy: boolean;
  error: string;
  readonly: boolean;
  applyHarness: (h: Harness) => void;
  onQuote:(text:string)=>void;
  folders:{id:string;title:string}[];
  defaultFolder:string;
  savePage:(index:number,kind:"note"|"branch",title:string,parent:string)=>Promise<void>;
}) {
  const view = useRef<HTMLDivElement>(null),
    follow = useRef(reading.follow);
  const [away, setAway] = useState(!reading.follow),
    [copied, setCopied] = useState<number | null>(null),
    [copyError, setCopyError] = useState("");
  useEffect(() => {
    if (copied === null) return;
    const timer = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);
  useLayoutEffect(() => {
    if (view.current && !reading.follow) view.current.scrollTop = reading.top;
  }, [reading]);
  useLayoutEffect(() => {
    if (follow.current && view.current)
      view.current.scrollTop = view.current.scrollHeight;
  }, [turns.length, preview, phase, pending, error]);
  const [finding,setFinding]=useState(false), [query,setQuery]=useState(""), [match,setMatch]=useState(0);
  const [quote,setQuote]=useState<{index:number;text:string}>();
  const [saving,setSaving]=useState<{index:number;kind:"note"|"branch";title:string;parent:string}>();
  const [savingBusy,setSavingBusy]=useState(false);
  const savedPosition=useRef({top:0,follow:true});
  const findInput=useRef<HTMLInputElement>(null);
  const results=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase();
    return term ? turns.flatMap((t,index)=>[t.prompt,t.answers.at(-1)?.text || ""].flatMap((text,part)=>
      text.toLocaleLowerCase().includes(term) ? [{index,part}] : [])) : [];
  },[turns,query]);
  function openFind(){
    if(!finding) savedPosition.current={top:view.current?.scrollTop || 0,follow:follow.current};
    follow.current=false;setFinding(true);requestAnimationFrame(()=>findInput.current?.focus());
  }
  function closeFind(){
    setFinding(false);setQuery("");setMatch(0);
    follow.current=savedPosition.current.follow;
    if(view.current) view.current.scrollTop=follow.current ? view.current.scrollHeight : savedPosition.current.top;
    reading.follow=follow.current;setAway(!follow.current);
  }
  useEffect(()=>{
    const panel=view.current?.closest(".xcode");
    const key=(event:Event)=>{const e=event as KeyboardEvent;
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==="f"){e.preventDefault();openFind();}
    };
    panel?.addEventListener("keydown",key);
    return ()=>panel?.removeEventListener("keydown",key);
  },[finding]);
  useLayoutEffect(()=>{
    const hit=results[match];
    const scroll=view.current;
    if (!finding || !hit || !scroll) return;
    const el=scroll.querySelector('[data-turn="'+hit.index+'"] '+(hit.part?".chat-answer":".chat-question"));
    if(el) scroll.scrollTop+=el.getBoundingClientRect().top-scroll.getBoundingClientRect().top;
  },[finding,match,results]);
  const previousLength=useRef(turns.length);
  const [unread,setUnread]=useState(false);
  useEffect(()=>{
    if(!follow.current && (turns.length>previousLength.current || preview)) setUnread(true);
    previousLength.current=turns.length;
  },[turns.length,preview]);
  const pendingVisible = pending && turns.length <= pending.index;
  return (
    <div className="chat-transcript">
      {turns.length>0 && <div className="chat-find">
        {finding ? <>
          <input ref={findInput} aria-label="세션 대화 검색" placeholder="질문·답변 검색" value={query} onChange={e=>{setQuery(e.target.value);setMatch(0);}}
            onKeyDown={e=>{if(e.key==="Escape") closeFind();if(e.key==="Enter" && results.length) setMatch((match+(e.shiftKey?-1:1)+results.length)%results.length);}}/>
          <small role="status">{results.length ? match+1 : 0} / {results.length}</small>
          {[-1,1].map(d=><button key={d} disabled={!results.length} aria-label={d<0?"이전 검색 결과":"다음 검색 결과"} onClick={()=>setMatch((match+d+results.length)%results.length)}>{d<0?"↑":"↓"}</button>)}
          <button onClick={closeFind}>닫기</button>
        </> : <button title="대화 찾기 (Ctrl/⌘+F)" aria-label="대화 찾기" onClick={openFind}><Search size={13}/></button>}
      </div>}
      <div
        className="chat-scroll"
        ref={view}
        role="region"
        tabIndex={0}
        aria-label="세션 대화"
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current = !finding &&
            el.scrollHeight - el.clientHeight - el.scrollTop < 48;
          if(follow.current) setUnread(false);
          if(finding) return;
          reading.top = el.scrollTop;
          reading.follow = follow.current;
          setAway(!follow.current);
        }}
      >
        {!turns.length && !pendingVisible && !busy && !error && (
          <div className="chat-empty">
            <Terminal size={23} />
            <h3>어떤 작업을 시작할까요?</h3>
          </div>
        )}
        {turns.map((t, i) => {
          const last = t.answers.at(-1);
          return (
            <article className="chat-turn" data-turn={i} data-found={finding && results[match]?.index===i ? results[match].part : undefined} key={t.runId || i}
              onMouseUp={()=>{const sel=window.getSelection();const answer=sel?.anchorNode?.parentElement?.closest(".chat-answer");
                if(sel?.toString().trim() && answer?.contains(sel.focusNode) && answer.closest("article")?.dataset.turn===String(i))
                  setQuote({index:i,text:sel.toString()});
              }}>

              <Question prompt={t.prompt} files={t.files.map((f) => f.name)} />
              {last && <Answer text={last.text} />}
              {last && last.text.includes("#") && <AnswerSources text={last.text} files={turns.slice(0,i+1).flatMap(turn=>turn.files)}/>}
              <div className="chat-result-actions">
                {last && (
                  <button
                    className="chat-action-icon"
                    aria-label={copied === i ? "복사됨" : "답변 복사"}
                    title={copied === i ? "복사됨" : "답변 복사"}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(last.text);
                        setCopied(i);
                        setCopyError("");
                      } catch {
                        setCopyError("클립보드에 복사할 수 없습니다.");
                      }
                    }}
                  >
                    {copied === i ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                )}
                {quote?.index===i && <button disabled={readonly} onClick={()=>{onQuote(quote.text);setQuote(undefined);}}>인용해 질문</button>}
                {last && <details className="chat-answer-menu"><summary className="chat-action-icon" aria-label="답변 메뉴" title="답변 메뉴"><MoreHorizontal size={13}/></summary>
                  {(["note","branch"] as const).map(kind=><button key={kind} disabled={readonly} onClick={e=>{
                    e.currentTarget.closest("details")!.open=false;
                    setSaving({index:i,kind,title:t.prompt.split("\n")[0].slice(0,60) || "답변",parent:defaultFolder});
                  }}>{kind==="note"?"노트로 저장":"여기서 새 세션"}</button>)}
                </details>}
                {saving?.index===i && <form className="answer-save" onSubmit={async e=>{
                  e.preventDefault();if(savingBusy || !saving.title.trim()) return;setSavingBusy(true);
                  try{await savePage(i,saving.kind,saving.title.trim(),saving.parent);setSaving(undefined);}
                  catch(err){setCopyError(String(err));}finally{setSavingBusy(false);}
                }}>
                  <input aria-label="새 페이지 제목" value={saving.title} onChange={e=>setSaving({...saving,title:e.target.value})} required/>
                  <select aria-label="저장할 폴더" value={saving.parent} onChange={e=>setSaving({...saving,parent:e.target.value})}><option value="@">워크스페이스</option>{folders.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select>
                  <button disabled={savingBusy || readonly}>저장</button><button type="button" onClick={()=>setSaving(undefined)}>취소</button>
                </form>}
                <details>
                  <summary className="chat-action-icon" aria-label="실행 기록" title="실행 기록">
                    <History size={11} aria-hidden="true" />
                  </summary>
                  {t.execution && (
                    <p>
                      {[
                        t.execution.model,
                        t.execution.harness,
                        ...(t.execution.configuration?.jobRole && validHarness(t.execution.configuration) ? [t.execution.configuration.jobRole] : []),
                        ...t.execution.skills,
                      ].join(" · ")}
                    </p>
                  )}
                  {t.answers.map((a, j) => (
                    <details key={j}>
                      <summary>
                        {j + 1}. {a.stage}{" "}
                        {a.elapsedMs != null &&
                          " · " + (a.elapsedMs / 1000).toFixed(1) + "초"}
                      </summary>
                      <small>
                        {[
                          a.effort && "추론 " + a.effort,
                          a.retries != null && "재시도 " + a.retries + "회",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      {j < t.answers.length - 1 && <Answer text={a.text} />}
                    </details>
                  ))}
                  {t.execution?.configuration &&
                    validHarness(t.execution.configuration) && (
                      <button
                        disabled={busy || readonly}
                        onClick={() =>
                          applyHarness(
                            structuredClone(t.execution!.configuration!),
                          )
                        }
                      >
                        이 실행의 하네스 복제
                      </button>
                    )}
                </details>
              </div>
            </article>
          );
        })}
        {pendingVisible && (
          <Question prompt={pending.prompt} files={pending.files} />
        )}
        {(busy || preview) && (
          <div className="chat-live" role="group" aria-label="모델 답변">
            {busy && <small role="status">{phase || "요청 준비 중"}</small>}
            {preview && <pre>{preview}</pre>}
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {copyError && <p role="alert">{copyError}</p>}
      </div>
      {away && (
        <button
          className="chat-latest"
          onClick={() => {
            follow.current = true;
            if (view.current)
              view.current.scrollTop = view.current.scrollHeight;
            reading.follow=true;setUnread(false);setAway(false);
          }}
        >
          <ArrowDown size={14} /> {unread ? "새 답변 보기" : "최신 메시지"}
        </button>
      )}
    </div>
  );
}
