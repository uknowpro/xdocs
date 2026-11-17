import * as Y from "yjs";
import pg from "pg";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { WorkspaceService } from "../server/service.mjs";
import { CollaborationService } from "../server/collaboration.mjs";
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://xdocs:xdocs-local-only@127.0.0.1:55432/xdocs";
const admin = new pg.Pool({ connectionString }),
  schema = "soak_" + randomUUID().replaceAll("-", "");
await admin.query("CREATE SCHEMA " + schema);
const pool = new pg.Pool({
    connectionString,
    options: "-c search_path=" + schema,
  }),
  docs = [];
const seconds = Number(process.env.XDOCS_SOAK_SECONDS || 60);
try {
  const service = new WorkspaceService(pool),
    collab = new CollaborationService(service),
    workspace = randomUUID(),
    id = randomUUID();
  await service.initialize();
  await pool.query("INSERT INTO workspaces VALUES($1,$2)", [workspace, "soak"]);
  await pool.query("INSERT INTO members VALUES($1,'tester','owner')", [
    workspace,
  ]);
  await service.mutate(workspace, "tester", {
    id,
    operationId: randomUUID(),
    baseVersion: 0,
    body: "# Load\n\nStart",
    deleted: false,
  });
  const seed = await collab.transact(
    workspace,
    "tester",
    id,
    undefined,
    "blocks",
  );
  for (let i = 0; i < 8; i++) {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, Buffer.from(seed.state, "base64"));
    docs.push(doc);
  }
  const submit = async (doc) => {
    const p = await collab.transact(workspace, "tester", id, {
      generation: seed.generation,
      state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
    });
    Y.applyUpdate(doc, Buffer.from(p.state, "base64"));
    return p;
  };
  let edits = 0,
    peakBytes = 0;
  const start = performance.now();
  while (performance.now() - start < seconds * 1000) {
    const client = edits % docs.length,
      doc = docs[client];
    doc.getArray("blocks").get(1).get("text").insert(0, `[${client}:${edits}]`);
    edits++;
    if (edits % 7 !== 0) {
      const result = await submit(doc);
      peakBytes = Math.max(
        peakBytes,
        Buffer.from(result.state, "base64").length,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  let result;
  for (const doc of docs) result = await submit(doc);
  const markers = result.body.match(/\[\d+:\d+\]/g) || [];
  assert.equal(markers.length, edits);
  assert.equal(new Set(markers).size, edits);
  const before = result.version;
  result = await submit(docs.at(-1));
  assert.equal(result.version, before);
  console.log(
    JSON.stringify(
      {
        seconds,
        clients: 8,
        edits,
        peakStateBytes: peakBytes,
        peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
        lostEdits: 0,
        duplicateEdits: 0,
      },
      null,
      2,
    ),
  );
} finally {
  for (const d of docs) d.destroy();
  await pool.end();
  await admin.query("DROP SCHEMA " + schema + " CASCADE");
  await admin.end();
}
