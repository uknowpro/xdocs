// @ denotes the vault root. An empty parent keeps the page in its physical folder.
export const parentHeader =
  /^<!-- xdocs:parent=([\w@-]*)(?: order=([0-9a-f]+))? -->\r?\n/;
export function withParent(id, body, order = "") {
  if (
    (!id && !order) ||
    (id && (typeof id !== "string" || !/^(?:[\w-]+|@)$/.test(id))) ||
    (order && (typeof order !== "string" || !/^[0-9a-f]+$/.test(order)))
  )
    return body;
  return (
    "<!-- xdocs:parent=" +
    (id || "") +
    (order ? " order=" + order : "") +
    " -->\n" +
    body
  );
}
export function pageOrder(note) {
  const stored = note.body.match(parentHeader)?.[2];
  if (stored) return stored;
  const encode = (s) =>
    s
      .split("")
      .map((ch) => ch.charCodeAt(0).toString(16).padStart(4, "0"))
      .join("");
  return (
    encode(note.title.slice(0, 8)) +
    "0000" +
    Array.from(note.id, (ch) =>
      ch.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("") +
    "8"
  );
}
export function orderBetween(low, high) {
  if (low && high && low >= high) throw Error("페이지 순서를 새로고침하세요.");
  let prefix = "";
  for (let i = 0; i < 150; i++) {
    const a = low && i < low.length ? parseInt(low[i], 16) : 0;
    const b = high && i < high.length ? parseInt(high[i], 16) : 16;
    if (b - a > 1) return prefix + Math.floor((a + b) / 2).toString(16);
    prefix += a.toString(16);
    if (b > a) high = null;
  }
  throw Error("두 페이지 사이에 더 이상 배치할 수 없습니다.");
}

export const folderMarker = "<!-- xdocs:folder -->\n";
export function folderBody(parent, name) {
  return withParent(parent, folderMarker + "# " + name + "\n");
}
export function isFolderPage(note) {
  return note.body.replace(parentHeader, "").startsWith(folderMarker);
}
