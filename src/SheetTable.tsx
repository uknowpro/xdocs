import { usePaneHeight } from "./usePaneHeight";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, Copy, ChevronLeft, ChevronRight, FileText, Trash2 } from "lucide-react";
import {
  parseDelimited,
  toTSV,
  validateWorkbook,
  sheetMarkdown,
} from "../shared/tabular.mjs";
export interface SheetBook {
  version: 1;
  sheets: {
    id: string;
    name: string;
    firstRowHeader?: boolean;
    rows: string[][];
  }[];
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
    rowCount = Math.max(1, sheet.rows.length);
  const headerRows = sheet.firstRowHeader ? 1 : 0;
  const dataRowCount = Math.max(0, sheet.rows.length - headerRows);
  const firstDataIndex = page * 100 + headerRows;
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
          rows: Array.from({length:10},()=>["","","",""]),
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
  const editing = useRef<HTMLTextAreaElement | null>(null);
  const pointer = useRef<number | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  usePaneHeight(viewport);
  const frame = useRef<number | null>(null);
  const position = useRef<{x:number; y:number} | null>(null);

  function stopDrag() {
    pointer.current = null;
    position.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }
  useEffect(() => {
    window.addEventListener("blur", stopDrag);
    return () => { window.removeEventListener("blur", stopDrag); stopDrag(); };
  }, [sheet.id, page]);

  function updateDrag(scroll: boolean) {
    const el = viewport.current;
    if (!el || pointer.current === null || !position.current) return;
    const rect = el.getBoundingClientRect();
    const left = Math.max(0, rect.left + el.clientLeft);
    const top = Math.max(0, rect.top + el.clientTop);
    const right = Math.min(innerWidth, rect.left + el.clientLeft + el.clientWidth);
    const bottom = Math.min(innerHeight, rect.top + el.clientTop + el.clientHeight);
    if (right <= left || bottom <= top) return;
    const { x, y } = position.current;
    function step(value: number, low: number, high: number) {
      const band = Math.min(40, (high - low) / 3);
      if (value < low + band) return -Math.ceil(18 * Math.min(1, (low + band - value) / band));
      if (value > high - band) return Math.ceil(18 * Math.min(1, (value - high + band) / band));
      return 0;
    }
    const dx = step(x, left, right), dy = step(y, top, bottom);
    if (scroll) el.scrollBy(dx, dy);
    const hitX = Math.max(left + 1, Math.min(x, right - 1));
    const header = el.querySelector("thead th");
    const topCell = header && (el.scrollTop > 0 || !sheet.firstRowHeader)
      ? Math.max(top, header.getBoundingClientRect().bottom) : top;
    const hitY = Math.min(bottom - 1, Math.max(topCell + 1, y));
    const table = el.querySelector("table");
    if (table) {
      const rows = table.tBodies[0].rows;
      const headerHit = sheet.firstRowHeader && header && hitY < header.getBoundingClientRect().bottom;
      const row = headerHit ? table.tHead?.rows[0] :
        Array.from(rows).find(tr => tr.getBoundingClientRect().bottom > hitY) || rows[rows.length - 1];
      if (row) {
        // A rounded corner or an overlay scrollbar can cover the cell under the pointer.
        const cells = row.cells;
        const column = Array.from(cells).findIndex(td => td.getBoundingClientRect().right > hitX);
        const cell = cells[column < 0 ? cells.length - 1 : Math.max(1, column)]?.querySelector("textarea");
        if (cell) {
          const r = Number(cell.dataset.row), c = Number(cell.dataset.column);
          setEnd(prev => prev[0] === r && prev[1] === c ? prev : [r,c]);
        }
      }
    }
    const canMove = (dx < 0 && el.scrollLeft > 0) || (dx > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth)
      || (dy < 0 && el.scrollTop > 0) || (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight);
    if (canMove && frame.current === null) frame.current = requestAnimationFrame(() => {
      frame.current = null;
      updateDrag(true);
    });
  }
  function changePage(next: number) {
    setPage(next);
    setAnchor([next * 100 + headerRows, 0]);
    setEnd([next * 100 + headerRows, 0]);
  }
  const axisAnchor = useRef<{axis:"row"|"column"; index:number} | null>(null);
  function selectAxis(axis:"row"|"column", index:number, extend:boolean) {
    const first = extend && axisAnchor.current?.axis === axis ? axisAnchor.current.index : index;
    axisAnchor.current = {axis,index:first};
    setAnchor(axis === "row" ? [first,0] : [0,first]);
    setEnd(axis === "row" ? [index,columns-1] : [rowCount-1,index]);
  }
  const menuRef = useRef<HTMLDivElement>(null);
  const [rowMenu, setRowMenu] = useState<{
    row: number; first: number; last: number; x: number; y: number;
  } | null>(null);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!rowMenu || !menu) return;
    menu.showPopover();
    const place = (point: number, size: number, limit: number) =>
      Math.max(4, Math.min(point + 2, limit - size - 4));
    menu.style.left = place(rowMenu.x, menu.offsetWidth, innerWidth) + "px";
    menu.style.top = place(rowMenu.y, menu.offsetHeight, innerHeight) + "px";
    menu.querySelector("button")?.focus({preventScroll:true});
    const close = () => menu.hidePopover();
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("resize", close); close(); };
  }, [rowMenu]);

  function deleteRows(first: number, last: number) {
    if (readonly || first < headerRows || last >= sheet.rows.length) return;
    const rows = sheet.rows.filter((_, index) => index < first || index > last);
    commit({...workbook, sheets: workbook.sheets.map(s => s.id === sheet.id ? {...s, rows} : s)});
    const row = Math.max(0, Math.min(first, rows.length - 1));
    const column = Math.min(minC, Math.max(4, ...rows.map(r => r.length)) - 1);
    setPage(Math.floor(Math.max(0, row - headerRows) / 100));
    setAnchor([row, column]);
    setEnd([row, column]);
    axisAnchor.current = null;
    setRowMenu(null);
    requestAnimationFrame(() => viewport.current?.querySelector<HTMLTextAreaElement>(
      `textarea[data-row="${row}"][data-column="${column}"]`)?.focus());
  }
  function axisButton(axis:"row"|"column", index:number, label:string) {
    return <button type="button" className="sheet-axis" aria-label={label+(axis==="row"?"행 선택":"열 선택")}
      onClick={e=>selectAxis(axis,index,e.shiftKey)}>{label}</button>;
  }
  function renderRow(r: number, header = false) {
    const Cell = header ? "th" : "td";
    return (
      <tr key={r} onContextMenu={e => {
        if (readonly || header || r >= sheet.rows.length) return;
        const cell = (e.target as Element).closest("td,th") as HTMLTableCellElement | null;
        if (!cell) return;
        e.preventDefault();
        stopDrag();
        const column = cell.cellIndex - 1;
        const inside = r >= minR && r <= maxR && (column < 0 || (column >= minC && column <= maxC));
        if (!inside) {
          if (column < 0) selectAxis("row", r, false);
          else { axisAnchor.current = null; setAnchor([r,column]); setEnd([r,column]); }
        }
        const bounds = cell.getBoundingClientRect();
        const keyboard = e.clientX === 0 && e.clientY === 0;
        setRowMenu({row:r, first:inside ? Math.max(headerRows,minR) : r,
          last:inside ? Math.min(maxR,sheet.rows.length - 1) : r,
          x:keyboard ? bounds.left : e.clientX, y:keyboard ? bounds.bottom : e.clientY});
      }}>
        {header ? <th aria-hidden="true" /> : <th scope="row">{axisButton("row",r,String(r + 1 - headerRows))}</th>}
        {Array.from({ length: columns }, (_, c) => (
          <Cell
            scope={header ? "col" : undefined}
            key={c}
            className={
              r >= minR && r <= maxR && c >= minC && c <= maxC ? "selected" : ""
            }
          >
            {header && <button type="button" className="sheet-column-select" aria-label={letter(c)+"열 선택"} onClick={e=>selectAxis("column",c,e.shiftKey)}>▾</button>}
            <textarea
              rows={1}
              data-multiline={sheet.rows[r]?.[c]?.includes("\n") || undefined}
              aria-label={`${sheet.name} ${letter(c)}${r + 1}`}
              value={sheet.rows[r]?.[c] || ""}
              readOnly={readonly}
              onDoubleClick={e => { editing.current = e.currentTarget; }}
              onBlur={() => { editing.current = null; }}
              onKeyDown={(e) => {
                if (e.key === "F2") {
                  e.preventDefault();
                  editing.current = e.currentTarget;
                  setAnchor([r, c]);
                  setEnd([r, c]);
                  return;
                }
                if (editing.current === e.currentTarget) {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    editing.current = null;
                    e.currentTarget.setSelectionRange(e.currentTarget.selectionEnd, e.currentTarget.selectionEnd);
                    return;
                  }
                  if (e.key !== "Tab") return;
                  editing.current = null;
                }
                const extend = e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
                if (e.altKey || e.ctrlKey || e.metaKey ||
                    (!extend && !["Tab", "ArrowDown", "ArrowUp"].includes(e.key))) return;
                e.preventDefault();
                let nr = r,
                  nc = c;
                if (extend) {
                  nr = end[0] + Number(e.key === "ArrowDown") - Number(e.key === "ArrowUp");
                  nc = Math.max(0, Math.min(columns - 1, end[1] + Number(e.key === "ArrowRight") - Number(e.key === "ArrowLeft")));
                } else if (e.key === "Tab") {
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
                if (!extend) setAnchor([nr, nc]);
                setEnd([nr, nc]);
                setPage(Math.floor(Math.max(0, nr - headerRows) / 100));
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
          </Cell>
        ))}
      </tr>
    );
  }
  return (
    <section className="sheet-book" aria-label="시트 탭형 테이블">
      <div className="sheet-toolbar">
        <button
          className="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(toTSV(selection()));
              setMessage("");
            } catch {
              setMessage("클립보드에 복사하지 못했습니다.");
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
        {!readonly && (
          <button
            className="button"
            onClick={() => {
              const range =
                sheet.name +
                "!" +
                letter(minC) +
                (minR + 1) +
                ":" +
                letter(maxC) +
                (maxR + 1);
              onNote(
                range,
                "# " +
                  range +
                  "\n\n" +
                  sheetMarkdown({
                    ...sheet,
                    firstRowHeader: !!sheet.firstRowHeader && minR === 0,
                    rows: selection(),
                  }) +
                  "\n",
              );
            }}
          >
            선택 범위를 노트로 복제
          </button>
        )}
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
      {message && <p role="status">{message}</p>}
      <div className="sheet-grid-settings">
        <span>
          <strong>{sheet.name}</strong> · {sheet.rows.length.toLocaleString()}행
        </span>
        <label className="sheet-header-option">
          <input
            type="checkbox"
            checked={Boolean(sheet.firstRowHeader)}
            disabled={readonly}
            onChange={(e) => {
              const checked = e.target.checked;
              setPage(Math.max(0, Math.min(page, Math.floor((rowCount - Number(checked) - 1) / 100))));
              commit({
                ...workbook,
                sheets: workbook.sheets.map((s) =>
                  s.id === sheet.id
                    ? { ...s, firstRowHeader: checked }
                    : s,
                ),
              });
            }}
          />
          첫 행을 헤더로 사용
        </label>
      </div>
      <div
        className="sheet-scroll"
        ref={viewport}
        onCopy={(e) => {
          e.preventDefault();
          const input = e.target;
          const text = minR === maxR && minC === maxC && input instanceof HTMLTextAreaElement &&
            input.selectionStart !== input.selectionEnd
            ? input.value.slice(input.selectionStart, input.selectionEnd)
            : toTSV(selection());
          e.clipboardData.setData("text/plain", text);
        }}
        onPaste={(e) => {
          if (readonly || editing.current === e.target) return;
          e.preventDefault();
          paste(e.clipboardData.getData("text/plain"));
        }}
      >
        <table
          className="sheet-grid"
          aria-label={sheet.name}
          onPointerDown={(e) => {
            const cell = (e.target as Element).closest("textarea");
            if (!cell || e.button !== 0 || (editing.current === cell && !e.shiftKey)) return;
            editing.current = null;
            const pos: [number, number] = [
              Number(cell.dataset.row),
              Number(cell.dataset.column),
            ];
            axisAnchor.current = null;
            if (!e.shiftKey) setAnchor(pos);
            setEnd(pos);
            if (e.pointerType === "mouse") {
              pointer.current = e.pointerId;
              cell.setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            if (pointer.current !== e.pointerId || !(e.buttons & 1)) return;
            position.current = {x:e.clientX,y:e.clientY};
            updateDrag(false);
          }}
          onLostPointerCapture={stopDrag}
          onPointerUp={(e) => {
            if (pointer.current !== e.pointerId) return;
            if (position.current) {
              position.current = {x:e.clientX,y:e.clientY};
              updateDrag(false);
            }
            stopDrag();
          }}
          onPointerCancel={stopDrag}
        >
          <thead>
            {sheet.firstRowHeader ? renderRow(0, true) : (
            <tr>
              <th></th>
              {Array.from({ length: columns }, (_, c) => (
                <th key={c}>{axisButton("column",c,letter(c))}</th>
              ))}
            </tr>
            )}
          </thead>
          <tbody>
            {Array.from(
              { length: Math.min(100, Math.max(0, rowCount - firstDataIndex)) },
              (_, offset) => renderRow(firstDataIndex + offset),
            )}
          </tbody>
        </table>
      </div>
      {!readonly && rowMenu && <div ref={menuRef} popover="auto" className="sheet-row-menu"
        aria-label="행 작업" role="group" onToggle={e => {
          if (!e.currentTarget.matches(":popover-open")) setRowMenu(null);
        }}>
        <button type="button" onClick={() => deleteRows(rowMenu.row, rowMenu.row)}>
          <Trash2 size={14}/> {rowMenu.row + 1 - headerRows}행 삭제
        </button>
        {rowMenu.last > rowMenu.first && <button type="button"
          onClick={() => deleteRows(rowMenu.first, rowMenu.last)}>
          <Trash2 size={14}/> 선택한 {rowMenu.last - rowMenu.first + 1}개 행 삭제
        </button>}
      </div>}
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
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {dataRowCount ? `${page * 100 + 1}–${Math.min(dataRowCount, (page + 1) * 100)}` : "0행"}
          </span>
          <button
            aria-label="다음 100행"
            disabled={(page + 1) * 100 >= dataRowCount}
            onClick={() => changePage(page + 1)}
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
