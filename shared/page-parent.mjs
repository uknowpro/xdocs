export const parentHeader = /^<!-- xdocs:parent=([\w-]+) -->\r?\n/;
export function withParent(id, body) {
  return id && /^[\w-]+$/.test(id)
    ? "<!-- xdocs:parent=" + id + " -->\n" + body
    : body;
}
