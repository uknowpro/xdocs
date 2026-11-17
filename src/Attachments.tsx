import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { api } from "./api";
export default function Attachments({ body }: { body: string }) {
  const paths = [
    ...new Set(
      [
        ...body.matchAll(
          /\((assets\/[a-f0-9-]{36}\.(?:png|jpe?g|webp|gif|pdf|xlsx|xlsm|xls|xlsb|csv|tsv|txt))\)/gi,
        ),
      ].map((m) => m[1]),
    ),
  ];
  const [urls, setUrls] = useState<
      Record<string, { url: string; mime: string }>
    >({}),
    [error, setError] = useState(""),
    [pdf, setPdf] = useState("");
  const key = paths.join("|");
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    setUrls({});
    if (!api.readAttachment) return;
    void Promise.all(
      paths.map(async (p) => {
        try {
          const a = await api.readAttachment!(p);
          const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: a.mime }));
          created.push(url);
          if (!cancelled)
            setUrls((old) => ({ ...old, [p]: { url, mime: a.mime } }));
          else URL.revokeObjectURL(url);
        } catch (e) {
          if (!cancelled) setError(String(e));
        }
      }),
    );
    return () => {
      cancelled = true;
      created.forEach(URL.revokeObjectURL);
    };
  }, [key]);
  if (!paths.length) return null;
  return (
    <section className="attachments" aria-label="노트 첨부파일">
      {error && <p role="alert">{error}</p>}
      {paths.map((p) =>
        urls[p]?.mime === "application/octet-stream" ? (
          <button
            key={p}
            className="attachment-pdf"
            onClick={() =>
              void api.openAttachment?.(p).catch((e) => setError(String(e)))
            }
          >
            <FileText size={20} />
            원본 파일 열기
          </button>
        ) : urls[p]?.mime === "application/pdf" ? (
          <button
            key={p}
            className="attachment-pdf"
            onClick={() => setPdf(urls[p].url)}
          >
            <FileText size={20} />
            <span>PDF 문서 열기</span>
          </button>
        ) : urls[p] ? (
          <img key={p} src={urls[p].url} alt="노트 첨부 이미지" />
        ) : (
          <p key={p} className="small-text muted">
            첨부파일 불러오는 중…
          </p>
        ),
      )}
      {pdf && (
        <div className="overlay">
          <section
            className="dialog pdf-dialog"
            role="dialog"
            aria-label="PDF 보기"
          >
            <button className="button" onClick={() => setPdf("")}>
              <X size={16} />
              닫기
            </button>
            <iframe src={pdf} title="PDF 문서" />
          </section>
        </div>
      )}
    </section>
  );
}
