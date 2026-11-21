import { terraformAddress } from "./architecture.mjs";

// Track object paths without reformatting imported JSON or matching text inside strings.
export function jsonDeclarationLines(source) {
  const found = new Map(),
    stack = [];
  let key,
    keyLine,
    line = 1;
  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]|\n/g)) {
    const token = match[0];
    if (token === "\n") {
      line++;
      continue;
    }
    if (token.startsWith('"')) {
      key = JSON.parse(token);
      keyLine = line;
      continue;
    }
    if (token === ":") {
      if (stack.length) {
        stack.at(-1).key = key;
        stack.at(-1).line = keyLine;
      }
      continue;
    }
    if (token === "," || token === "}" || token === "]") {
      if (token !== ",") stack.pop();
      if (stack.length) stack.at(-1).key = undefined;
      continue;
    }
    const parent = stack.at(-1);
    const path = parent ? [...parent.path, parent.key] : [];
    if (token === "{") {
      let address;
      if (path.length === 3 && path[0] === "resource")
        address = path.slice(1).join(".");
      else if (path.length === 3 && path[0] === "data")
        address = path.join(".");
      else if (path.length === 2 && path[0] === "module")
        address = path.join(".");
      if (address) found.set(address, parent.line);
    }
    stack.push({ path, key: undefined, line });
  }
  return found;
}
export function declarationLines(source, file, nodes) {
  const lines = new Map();
  const parsed = file?.endsWith(".tf.json")
    ? jsonDeclarationLines(source)
    : new Map();
  for (const n of nodes) {
    const line =
      parsed.get(terraformAddress(n)) ||
      ("terraform/" + n.sourceFile === file && n.sourceLine);
    // Minified files can contain several declarations on one line. Use the declaration selector there.
    if (line) lines.set(line, lines.has(line) ? null : n.id);
  }
  return new Map([...lines].filter(([, id]) => id));
}
