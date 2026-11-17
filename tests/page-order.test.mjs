import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import {
  orderBetween,
  pageOrder,
  parentHeader,
  withParent,
} from "../shared/page-parent.mjs";
import { collaborationBody, seedBlocks } from "../shared/collab-blocks.mjs";
test("ranked headers preserve legacy hierarchy and ordering through collaboration", () => {
  const old = withParent("demo-1", "# child");
  assert.equal(old, "<!-- xdocs:parent=demo-1 -->\n# child");
  const a = pageOrder({ id: "demo-1", title: "첫 페이지", body: "" }),
    b = orderBetween(a, null),
    c = orderBetween(a, b);
  assert.ok(a < c && c < b);
  for (const parent of ["demo-1", "@", ""]) {
    const raw = withParent(parent, "# child", c),
      doc = new Y.Doc();
    seedBlocks(doc, raw);
    assert.equal(collaborationBody(doc), raw);
    assert.equal(raw.match(parentHeader)[2], c);
  }
});
