import * as Y from "yjs";
export function seedBlocks(doc, body) {
  doc.getMap("meta").set("format", "blocks-v1");
  doc.getArray("blocks").push(
    body.split("\n\n").map((text, index) => {
      const block = new Y.Map();
      block.set("id", String(index));
      block.set("text", new Y.Text(text));
      return block;
    }),
  );
}
export function collaborationBody(doc) {
  if (doc.getMap("meta").get("format") !== "blocks-v1")
    return doc.getText("markdown").toString();
  return doc
    .getArray("blocks")
    .toArray()
    .map((block) => {
      if (
        !(block instanceof Y.Map) ||
        typeof block.get("id") !== "string" ||
        !(block.get("text") instanceof Y.Text)
      )
        throw Error("Invalid collaboration block");
      return block.get("text").toString();
    })
    .join("\n\n");
}
export function editText(doc, shared, value) {
  const prior = shared.toString();
  let start = 0,
    end = 0;
  while (
    start < prior.length &&
    start < value.length &&
    prior[start] === value[start]
  )
    start++;
  while (
    end < prior.length - start &&
    end < value.length - start &&
    prior[prior.length - end - 1] === value[value.length - end - 1]
  )
    end++;
  doc.transact(() => {
    if (prior.length - start - end)
      shared.delete(start, prior.length - start - end);
    if (value.length - start - end)
      shared.insert(start, value.slice(start, value.length - end));
  }, "local");
}
