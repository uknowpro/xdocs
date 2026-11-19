import { useEffect, useRef, useState } from "react";
import { api } from "./api";

export type AnalyzerSource = {
  session: string;
  file: string;
  line: number | null;
  template: boolean;
};

export function AnalyzerEvidence({
  source,
  evidence,
  initiallyOpen = false,
}: {
  source?: AnalyzerSource;
  evidence: string;
  initiallyOpen?: boolean;
}) {
  const [opened, setOpened] = useState(initiallyOpen);
  const [text, setText] = useState<string>();
  const [error, setError] = useState("");
  const panel = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (!opened || !source || !api.analyzerSource) return;
    let active = true;
    setText(undefined);
    setError("");
    api.analyzerSource(source).then(
      (value) => {
        if (active) setText(value);
      },
      (e) => {
        if (active) setError(String(e));
      },
    );
    return () => {
      active = false;
    };
  }, [opened, source]);
  useEffect(() => {
    const box = panel.current;
    const line = box?.querySelector("mark");
    if (box && line) box.scrollTop = line.offsetTop - box.clientHeight / 3;
  }, [text]);
  if (!source || !api.analyzerSource) return <small>{evidence}</small>;
  const lines = text?.split(/\r?\n/);
  const index = (source.line || 0) - 1;
  const hasLine = lines && index >= 0 && index < lines.length;
  return (
    <div className="analyzer-evidence">
      <button
        type="button"
        aria-expanded={opened}
        onClick={() => setOpened(!opened)}
      >
        {source.template ? "Helm 템플릿" : "원본"} · {source.file}
        {source.line ? ":" + source.line : ""}
      </button>
      {opened && (
        <>
          {evidence && <small>분석 근거 · {evidence}</small>}
          {error ? (
            <p role="alert">{error}</p>
          ) : text === undefined ? (
            <p role="status">원본을 여는 중…</p>
          ) : (
            <pre ref={panel} tabIndex={0} aria-label={source.file}>
              {hasLine ? (
                <>
                  {index > 0 && lines.slice(0, index).join("\n") + "\n"}
                  <mark>{lines[index]}</mark>
                  {"\n" + lines.slice(index + 1).join("\n")}
                </>
              ) : (
                text
              )}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
