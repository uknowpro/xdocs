import { useMemo } from "react";
import type { InputFile } from "./xcode-session";
import { columnName, coordinates, type TextInput } from "./workspace-input";

type Span = NonNullable<TextInput["sources"]>[number];
type Citation = {
  label: string;
  file: TextInput;
  place: string;
  value: string;
  first: Span;
  last: Span;
};
export function resolveCitation(
  files: InputFile[],
  label: string,
): Citation | undefined {
  const hits: Citation[] = [];
  for (const file of files) {
    if (
      !("text" in file) ||
      !Array.isArray(file.sources) ||
      !label.startsWith(file.name + "#")
    )
      continue;
    const place = label.slice(file.name.length + 1);
    const exact = file.sources.find((s) => s.place === place);
    if (exact) {
      hits.push({
        file,
        label,
        place,
        first: exact,
        last: exact,
        value: file.text.slice(exact.start, exact.start + exact.length),
      });
      continue;
    }
    const range = /^(.*)!([A-Z]+\d+):([A-Z]+\d+)$/.exec(place);
    if (!range) continue;
    const [, sheet, start, end] = range,
      a = coordinates(start),
      b = coordinates(end);
    if (!a || !b || a[0] > b[0] || a[1] > b[1]) continue;
    const first = file.sources.find((s) => s.place === sheet + "!" + start),
      last = file.sources.find((s) => s.place === sheet + "!" + end);
    if (!first || !last) continue;
    const value = file.sources
      .filter((s) => {
        const c =
          s.place.startsWith(sheet + "!") &&
          coordinates(s.place.slice(sheet.length + 1));
        return (
          c && c[0] >= a[0] && c[0] <= b[0] && c[1] >= a[1] && c[1] <= b[1]
        );
      })
      .map(
        (s) => s.place + " · " + file.text.slice(s.start, s.start + s.length),
      )
      .join("\n");
    hits.push({ file, label, place, first, last, value });
  }
  return hits.length && hits.every((h) => h.file.text === hits[0].file.text)
    ? hits[0]
    : undefined;
}

export function SourcePanel({
  hit,
  close,
  openOriginal,
}: {
  hit: Citation;
  close: () => void;
  openOriginal?: () => void;
}) {
  const { file, place, first, last } = hit;
  const sheet = /^(.*)!([A-Z]+\d+)$/.exec(first.place);
  const sources = file.sources || [];
  const text = (s: Span) => file.text.slice(s.start, s.start + s.length);
  const paragraph = Number(/^문단 (\d+)$/.exec(place)?.[1]);
  const a = sheet && coordinates(sheet[2]),
    b = sheet && coordinates(last.place.slice(sheet[1].length + 1));
  const cells = new Map(sources.map((s) => [s.place, s]));
  // Keep sparse and very large ranges navigable without allocating an empty worksheet.
  const nearby = (lo: number, hi: number, header: boolean) =>
    [
      ...new Set([
        ...(header ? [1] : []),
        Math.max(1, lo - 1),
        lo,
        ...Array.from({ length: Math.min(hi - lo, 10) }, (_, i) => lo + i + 1),
        hi,
        hi + 1,
      ]),
    ].sort((x, y) => x - y);
  const cols = a && b ? nearby(a[0], b[0], false) : [],
    rows = a && b ? nearby(a[1], b[1], true) : [];
  return (
    <aside aria-label="첨부 출처" className="source-panel">
      <header>
        <strong>{file.name}</strong>
        {openOriginal && <button onClick={openOriginal}>원본 열기</button>}
        <button onClick={close}>닫기</button>
      </header>
      <small>{place} · 첨부 당시</small>
      {sheet && a && b ? (
        <table>
          <thead>
            <tr>
              <th></th>
              {cols.map((c) => (
                <th key={c}>{columnName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th>{r}</th>
                {cols.map((c) => {
                  const cell = cells.get(sheet[1] + "!" + columnName(c) + r);
                  return (
                    <td
                      key={c}
                      data-cited={
                        c >= a[0] && c <= b[0] && r >= a[1] && r <= b[1]
                      }
                    >
                      {cell ? text(cell) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        sources
          .filter(
            (s) =>
              paragraph &&
              /^문단 \d+$/.test(s.place) &&
              Math.abs(Number(s.place.slice(3)) - paragraph) <= 2,
          )
          .map((s) => (
            <section key={s.start} data-cited={s === first}>
              <small>{s.place}</small>
              <p>{text(s)}</p>
            </section>
          ))
      )}
    </aside>
  );
}
export function answerCitations(text: string, files: InputFile[]) {
  const references = new Set(
    Array.from(
      text.matchAll(/\[([^\[\]\n]{1,400}#[^\[\]\n]{1,200})\]/g),
      (match) => match[1],
    ),
  );
  return [...references].flatMap(
    (label) => resolveCitation(files, label) || [],
  );
}
export default function AnswerSources({
  text,
  files,
  inspect,
}: {
  text: string;
  files: InputFile[];
  inspect: (hit: Citation) => void;
}) {
  const citations = useMemo(() => answerCitations(text, files), [text, files]);
  return (
    <>
      {citations.map((c) => (
        <details
          className="answer-source"
          key={c.label}
          onToggle={(e) => {
            if (e.currentTarget.open) inspect(c);
          }}
        >
          <summary onClick={() => inspect(c)}>{c.label}</summary>
          <pre hidden>{c.value}</pre>
        </details>
      ))}
    </>
  );
}
export type { Citation };
