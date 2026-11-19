import { useState } from "react";
import { Plus, Copy, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import {
  parseDelimited,
  toTSV,
  validateWorkbook,
  sheetMarkdown,
} from "../shared/tabular.mjs";
export interface SheetBook {
  version: 1;
  sheets: { id: string; name: string; rows: string[][] }[];
}
export default function SheetTable({
  workbook,
  onChange,
  onNote,
  readonly = false,
}: {
  workbook: SheetBook;
  onChange: (book: SheetBook) => void;
  onNote: (title: string, body: string) => void;
  readonly?: boolean;
}) {
  const [active, setActive] = useState(workbook.sheets[0].id),
    [page, setPage] = useState(0),
    [message, setMessage] = useState("");
  const [anchor, setAnchor] = useState<[number, number]>([0, 0]),
    [end, setEnd] = useState<[number, number]>([0, 0]);
  const sheet =
    workbook.sheets.find((s) => s.id === active) || workbook.sheets[0];
  const columns = Math.max(4, ...sheet.rows.map((r) => r.length)),
    rowCount = Math.max(10, sheet.rows.length);
  const minR = Math.min(anchor[0], end[0]),
    maxR = Math.max(anchor[0], end[0]),
    minC = Math.min(anchor[1], end[1]),
    maxC = Math.max(anchor[1], end[1]);
  const selection = () =>
    Array.from({ length: maxR - minR + 1 }, (_, r) =>
      Array.from(
        { length: maxC - minC + 1 },
        (_, c) => sheet.rows[r + minR]?.[c + minC] || "",
      ),
    );
  function commit(next: SheetBook) {
    try {
      validateWorkbook(next);
      onChange(next);
      setMessage("");
    } catch (e) {
      setMessage(String(e));
    }
  }
  function updateCell(r: number, c: number, value: string) {
    const rows = sheet.rows.map((row) => [...row]);
    while (rows.length <= r) rows.push([]);
    while (rows[r].length <= c) rows[r].push("");
    rows[r][c] = value;
    commit({
      ...workbook,
      sheets: workbook.sheets.map((s) =>
        s.id === sheet.id ? { ...s, rows } : s,
      ),
    });
  }
  function paste(text: string) {
    try {
      const input: string[][] = parseDelimited(text),
        rows = sheet.rows.map((row) => [...row]);
      input.forEach((row, r) => {
        const target = r + anchor[0];
        while (rows.length <= target) rows.push([]);
        row.forEach((value, c) => {
          while (rows[target].length <= c + anchor[1]) rows[target].push("");
          rows[target][c + anchor[1]] = value;
        });
      });
      commit({
        ...workbook,
        sheets: workbook.sheets.map((s) =>
          s.id === sheet.id ? { ...s, rows } : s,
        ),
      });
    } catch (e) {
      setMessage(String(e));
    }
  }
  function rename() {
    const name = prompt("시트 이름", sheet.name)?.trim();
    if (name)
      commit({
        ...workbook,
        sheets: workbook.sheets.map((s) =>
          s.id === sheet.id ? { ...s, name } : s,
        ),
      });
  }
  function add() {
    const id = crypto.randomUUID();
    commit({
      ...workbook,
      sheets: [
        ...workbook.sheets,
        {
          id,
          name: `시트 ${workbook.sheets.length + 1}`,
          rows: [["", "", "", ""]],
        },
      ],
    });
    setActive(id);
    setPage(0);
    setAnchor([0, 0]);
    setEnd([0, 0]);
  }
  const letter = (n: number) => {
    let label = "";
    for (n++; n; n = Math.floor((n - 1) / 26))
      label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
    return label;
  };
  return (
    <section className="sheet-book" aria-label="시트 탭형 테이블">
      <div className="sheet-toolbar">
        <span>
          <strong>{sheet.name}</strong> · {sheet.rows.length.toLocaleString()}행
        </span>
        <button
          className="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(toTSV(selection()));
              setMessage("선택 영역을 탭 구분으로 복사했습니다.");
            } catch {
              setMessage("표 안에서 Ctrl/Cmd+C로 복사해 주세요.");
            }
          }}
        >
          <Copy size={14} />
          선택 복사
        </button>
        <button
          className="button"
          disabled={readonly}
          onClick={() =>
            onNote(sheet.name, `# ${sheet.name}\n\n${sheetMarkdown(sheet)}\n`)
          }
        >
          <FileText size={14} />
          노트 표로 복제
        </button>
        {!readonly && <button className="button" onClick={()=>{
          const range=sheet.name+"!"+letter(minC)+(minR+1)+":"+letter(maxC)+(maxR+1);
          onNote(range,"# "+range+"\n\n"+sheetMarkdown({...sheet,rows:selection()})+"\n");
        }}>선택 범위를 노트로 복제</button>}
        {!readonly && (
          <>
            <button className="button" onClick={rename}>
              이름 변경
            </button>
            <button
              className="button"
              disabled={workbook.sheets.length === 1}
              onClick={() => {
                if (
                  confirm(
                    `“${sheet.name}” 시트를 삭제할까요? 변경 이력에서 복원할 수 있습니다.`,
                  )
                ) {
                  commit({
                    ...workbook,
                    sheets: workbook.sheets.filter((s) => s.id !== sheet.id),
                  });
                  setPage(0);
                  setAnchor([0, 0]);
                  setEnd([0, 0]);
                }
              }}
            >
              시트 삭제
            </button>
          </>
        )}
      </div>
      <p className="small-text muted">
        셀 클릭 후 Shift+클릭으로 범위 선택 · Ctrl/⌘ C 복사 · Ctrl/⌘ V 붙여넣기
        · 값만 저장하며 수식을 실행하지 않습니다.
      </p>
      {message && <p role="status">{message}</p>}
      <div
        className="sheet-scroll"
        onCopy={(e) => {
          e.preventDefault();
          e.clipboardData.setData("text/plain", toTSV(selection()));
        }}
        onPaste={(e) => {
          if (readonly) return;
          e.preventDefault();
          paste(e.clipboardData.getData("text/plain"));
        }}
      >
        <table className="sheet-grid" aria-label={sheet.name}>
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: columns }, (_, c) => (
                <th key={c}>{letter(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(
              { length: Math.min(100, Math.max(0, rowCount - page * 100)) },
              (_, offset) => {
                const r = page * 100 + offset;
                return (
                  <tr key={r}>
                    <th>{r + 1}</th>
                    {Array.from({ length: columns }, (_, c) => (
                      <td
                        key={c}
                        className={
                          r >= minR && r <= maxR && c >= minC && c <= maxC
                            ? "selected"
                            : ""
                        }
                      >
                        <textarea
                          rows={1}
                          aria-label={`${sheet.name} ${letter(c)}${r + 1}`}
                          value={sheet.rows[r]?.[c] || ""}
                          readOnly={readonly}
                          onClick={(e) => {
                            if (e.shiftKey) setEnd([r, c]);
                            else {
                              setAnchor([r, c]);
                              setEnd([r, c]);
                            }
                          }}

                          onKeyDown={(e) => {
                            if (
                              e.altKey ||
                              !["Tab", "ArrowDown", "ArrowUp"].includes(e.key)
                            )
                              return;
                            e.preventDefault();
                            let nr = r,
                              nc = c;
                            if (e.key === "Tab") {
                              nc += e.shiftKey ? -1 : 1;
                              if (nc >= columns) {
                                nc = 0;
                                nr++;
                              }
                              if (nc < 0) {
                                nc = columns - 1;
                                nr--;
                              }
                            } else nr += e.key === "ArrowDown" ? 1 : -1;
                            nr = Math.max(0, Math.min(rowCount - 1, nr));
                            setAnchor([nr, nc]);
                            setEnd([nr, nc]);
                            setPage(Math.floor(nr / 100));
                            const book = e.currentTarget.closest(".sheet-book");
                            requestAnimationFrame(() =>
                              book
                                ?.querySelector<HTMLTextAreaElement>(
                                  `textarea[data-row="${nr}"][data-column="${nc}"]`,
                                )
                                ?.focus(),
                            );
                          }}
                          data-row={r}
                          data-column={c}
                          onChange={(e) => updateCell(r, c, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
      <div className="sheet-footer">
        <div className="sheet-tabs" role="tablist" aria-label="워크시트">
          {workbook.sheets.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === sheet.id}
              onClick={() => {
                setActive(s.id);
                setPage(0);
                setAnchor([0, 0]);
                setEnd([0, 0]);
              }}
            >
              {s.name}
            </button>
          ))}
          {!readonly && (
            <button aria-label="시트 추가" onClick={add}>
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="sheet-pages">
          <button
            aria-label="이전 100행"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page * 100 + 1}–{Math.min(rowCount, (page + 1) * 100)}
          </span>
          <button
            aria-label="다음 100행"
            disabled={(page + 1) * 100 >= rowCount}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
          {!readonly && (
            <button
              onClick={() => {
                const rows = [
                  ...sheet.rows,
                  ...Array.from({ length: 10 }, () => Array(columns).fill("")),
                ];
                commit({
                  ...workbook,
                  sheets: workbook.sheets.map((s) =>
                    s.id === sheet.id ? { ...s, rows } : s,
                  ),
                });
              }}
            >
              10행 추가
            </button>
          )}
          {!readonly && (
            <button
              onClick={() => {
                const rows = Array.from({ length: rowCount }, (_, r) => [
                  ...(sheet.rows[r] || Array(columns).fill("")),
                  ...Array(
                    Math.max(0, columns - (sheet.rows[r]?.length || columns)),
                  ).fill(""),
                  "",
                ]);
                commit({
                  ...workbook,
                  sheets: workbook.sheets.map((s) =>
                    s.id === sheet.id ? { ...s, rows } : s,
                  ),
                });
              }}
            >
              열 추가
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
