import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, Copy, History, Terminal } from "lucide-react";
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
  applyHarness,
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
  const pendingVisible = pending && turns.length <= pending.index;
  return (
    <div className="chat-transcript">
      <div
        className="chat-scroll"
        ref={view}
        role="region"
        tabIndex={0}
        aria-label="세션 대화"
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current =
            el.scrollHeight - el.clientHeight - el.scrollTop < 48;
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
            <article className="chat-turn" key={t.runId || i}>
              <Question prompt={t.prompt} files={t.files.map((f) => f.name)} />
              {last && <Answer text={last.text} />}
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
            setAway(false);
          }}
        >
          <ArrowDown size={14} /> 최신 메시지
        </button>
      )}
    </div>
  );
}
