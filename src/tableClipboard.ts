import { toTSV } from "../shared/tabular.mjs";
export function selectedTableTSV(root: HTMLElement): string | null {
  const selected = Array.from(
    root.querySelectorAll<HTMLTableCellElement>(
      "td.selectedCell,th.selectedCell",
    ),
  );
  if (selected.length) {
    const table = selected[0].closest("table");
    if (!table) return null;
    return toTSV(
      Array.from(table.rows)
        .map((row) =>
          Array.from(row.cells)
            .filter((cell) => selected.includes(cell))
            .map((cell) => cell.innerText),
        )
        .filter((row) => row.length),
    );
  }
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const node = selection.anchorNode,
    table = (node instanceof Element ? node : node?.parentElement)?.closest(
      "table",
    );
  if (!table || !root.contains(table) || !table.contains(selection.focusNode))
    return null;
  const range = selection.getRangeAt(0);
  const rows = Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .filter((cell) => range.intersectsNode(cell))
        .map((cell) => cell.innerText),
    )
    .filter((row) => row.length);
  return rows.length ? toTSV(rows) : null;
}
