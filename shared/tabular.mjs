export const LIMITS = {
  sheets: 50,
  rows: 10000,
  columns: 256,
  cells: 100000,
  bytes: 4_000_000,
};
export function validateWorkbook(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.sheets) ||
    !value.sheets.length ||
    value.sheets.length > LIMITS.sheets
  )
    throw Error("올바른 시트 문서가 아닙니다.");
  let count = 0;
  const ids = new Set();
  for (const sheet of value.sheets) {
    if (
      !sheet ||
      typeof sheet.id !== "string" ||
      ids.has(sheet.id) ||
      typeof sheet.name !== "string" ||
      !sheet.name.trim() ||
      (sheet.firstRowHeader !== undefined && typeof sheet.firstRowHeader !== "boolean") ||
      sheet.name.length > 100 ||
      !Array.isArray(sheet.rows) ||
      sheet.rows.length > LIMITS.rows
    )
      throw Error("시트 이름 또는 크기를 확인해 주세요.");
    ids.add(sheet.id);
    for (const row of sheet.rows) {
      if (
        !Array.isArray(row) ||
        row.length > LIMITS.columns ||
        row.some((cell) => typeof cell !== "string")
      )
        throw Error("올바른 셀 데이터가 아닙니다.");
      count += row.length;
    }
  }
  if (
    count > LIMITS.cells ||
    new TextEncoder().encode(JSON.stringify(value)).length > LIMITS.bytes
  )
    throw Error("시트 크기 제한(10만 셀 / 4 MB)을 초과했습니다.");
  return value;
}
export function encodeWorkbook(value) {
  return (
    "```xdocs-sheets\n" +
    JSON.stringify(validateWorkbook(value)).replaceAll("`", "\\u0060") +
    "\n```"
  );
}
export function decodeWorkbook(body) {
  const match = body.match(/^```xdocs-sheets\r?\n([^]*?)\r?\n```$/m);
  if (!match) return null;
  return validateWorkbook(JSON.parse(match[1]));
}
export function replaceWorkbook(body, workbook) {
  const encoded = encodeWorkbook(workbook);
  return body.replace(/^```xdocs-sheets\r?\n[^]*?\r?\n```$/m, () => encoded);
}
export function toTSV(rows) {
  return rows
    .map((row) =>
      row
        .map((value) =>
          /[\t\r\n"]/.test(value)
            ? '"' + value.replaceAll('"', '""') + '"'
            : value,
        )
        .join("\t"),
    )
    .join("\r\n");
}
export function parseDelimited(text, delimiter = "\t") {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > LIMITS.bytes
  )
    throw Error("표 텍스트는 4 MB 이하만 지원합니다.");
  if (!["\t", ",", ";"].includes(delimiter))
    throw Error("지원하지 않는 구분자입니다.");
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false,
    cells = 0;
  const pushField = () => {
    row.push(field);
    field = "";
    closed = false;
    if (++cells > LIMITS.cells || row.length > LIMITS.columns)
      throw Error("셀 수 제한을 초과했습니다.");
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
    if (rows.length > LIMITS.rows) throw Error("행 수 제한을 초과했습니다.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === delimiter) pushField();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"' && !field && !closed) quoted = true;
    else {
      if (closed) throw Error("닫힌 따옴표 뒤에 잘못된 문자가 있습니다.");
      field += c;
    }
  }
  if (quoted) throw Error("닫히지 않은 따옴표가 있습니다.");
  if (field || row.length || closed || !rows.length) pushRow();
  return rows;
}
export function sheetMarkdown(sheet) {
  const width = Math.max(1, ...sheet.rows.map((r) => r.length));
  const escape = (value) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\\", "\\\\")
      .replaceAll("|", "\\|")
      .replace(/([`*_{}\[\]()!~])/g, "\\$1")
      .replace(/\r?\n/g, "<br>");
  const row = (values) =>
    "| " +
    Array.from({ length: width }, (_, i) => escape(values[i] || "")).join(
      " | ",
    ) +
    " |";
  return (
    row(sheet.firstRowHeader ? sheet.rows[0] || [] : Array(width).fill("")) +
    "\n" +
    row(Array(width).fill("---")) +
    "\n" +
    sheet.rows.slice(sheet.firstRowHeader ? 1 : 0).map(row).join("\n")
  );
}
