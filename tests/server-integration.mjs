import * as Y from "yjs";
import { CollaborationService } from "../server/collaboration.mjs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
import { WorkspaceService, principalFor } from "../server/service.mjs";
import { Events } from "../server/events.mjs";
import { createApi } from "../server/http.mjs";
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://xdocs:xdocs-local-only@127.0.0.1:55432/xdocs";
const admin = new pg.Pool({ connectionString }),
  schema = "test_" + randomUUID().replaceAll("-", "");
await admin.query("CREATE SCHEMA " + schema);
const pool = new pg.Pool({
  connectionString,
  options: "-c search_path=" + schema,
});
const events = new Events();
let api;
try {
  await events.connect(process.env.REDIS_URL || "redis://127.0.0.1:56379");
  const service = new WorkspaceService(pool, events);
  await service.initialize();
  const w = randomUUID(),
    other = randomUUID(),
    actor = principalFor("test", "owner"),
    reader = principalFor("test", "reader");
  await pool.query("INSERT INTO workspaces VALUES($1,$2),($3,$4)", [
    w,
    "테스트",
    other,
    "다른 팀",
  ]);
  await pool.query("INSERT INTO members VALUES($1,$2,$3),($1,$4,$5)", [
    w,
    actor,
    "owner",
    reader,
    "reader",
  ]);
  assert.equal((await service.list(actor)).length, 1);
  await assert.rejects(
    service.documents(other, actor),
    (e) => e.status === 403,
  );
  const op = {
    id: randomUUID(),
    operationId: randomUUID(),
    baseVersion: 0,
    body: "# 서버 노트",
    deleted: false,
  };
  const changed = new Promise((resolve) => events.once("change", resolve));
  const first = await service.mutate(w, actor, op);
  assert.equal(first.version, 1);
  assert.equal((await changed).id, op.id);
  assert.equal((await service.mutate(w, actor, op)).version, 1);
  await assert.rejects(
    service.mutate(w, reader, {
      ...op,
      operationId: randomUUID(),
      baseVersion: 1,
    }),
    (e) => e.status === 403,
  );
  await assert.rejects(
    service.mutate(w, actor, {
      ...op,
      operationId: randomUUID(),
      baseVersion: 0,
    }),
    (e) => e.status === 409,
  );
  await service.mutate(w, actor, {
    ...op,
    operationId: randomUUID(),
    baseVersion: 1,
    body: "# 두 번째",
    deleted: true,
  });
  assert.equal((await service.history(w, actor, op.id)).length, 2);
  assert.equal((await service.documents(w, actor)).notes[0].deleted, true);
  api = createApi({
    service,
    events,
    identity: { issuer: "test" },
    authenticate: async (header) => {
      if (header !== "Bearer test-owner")
        throw Object.assign(Error("unauthorized"), { status: 401 });
      return { principal: actor, expiresAt: Date.now() / 1000 + 1000 };
    },
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + api.address().port;
  assert.equal((await fetch(base + "/v1/workspaces")).status, 401);
  assert.equal(
    (
      await fetch(base + "/v1/workspaces/" + other + "/notes", {
        headers: { authorization: "Bearer test-owner" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await (
        await fetch(base + "/v1/workspaces", {
          headers: { authorization: "Bearer test-owner" },
        })
      ).json()
    ).length,
    1,
  );
  const collab = new CollaborationService(service);
  await collab.initialize();
  const live = {
    id: randomUUID(),
    operationId: randomUUID(),
    baseVersion: 0,
    body: "# 공동 문서\n\n시작",
    deleted: false,
  };
  await service.mutate(w, actor, live);
  const initial = await collab.transact(w, actor, live.id);
  const left = new Y.Doc(),
    right = new Y.Doc();
  Y.applyUpdate(left, Buffer.from(initial.state, "base64"));
  Y.applyUpdate(right, Buffer.from(initial.state, "base64"));
  left.getText("markdown").insert(left.getText("markdown").length, " A");
  right.getText("markdown").insert(right.getText("markdown").length, " B");
  await collab.transact(w, actor, live.id, {
    generation: initial.generation,
    state: Buffer.from(Y.encodeStateAsUpdate(left)).toString("base64"),
  });
  const merged = await collab.transact(w, actor, live.id, {
    generation: initial.generation,
    state: Buffer.from(Y.encodeStateAsUpdate(right)).toString("base64"),
  });
  assert.match(merged.body, /A/);
  assert.match(merged.body, /B/);
  await assert.rejects(
    collab.transact(w, reader, live.id, {
      generation: initial.generation,
      state: initial.state,
    }),
    (e) => e.status === 403,
  );
  const replay = await collab.transact(w, actor, live.id, {
    generation: initial.generation,
    state: Buffer.from(Y.encodeStateAsUpdate(right)).toString("base64"),
  });
  assert.equal(replay.version, merged.version);
  await service.mutate(w, actor, {
    ...live,
    operationId: randomUUID(),
    baseVersion: merged.version,
    body: "# 일반 편집",
  });
  await assert.rejects(
    collab.transact(w, actor, live.id, {
      generation: initial.generation,
      state: initial.state,
    }),
    (e) => e.status === 409,
  );
  left.destroy();
  right.destroy();
  console.log(
    "PASS PostgreSQL + Redis: RBAC, workspace isolation, idempotency, conflict detection, history, tombstones, Redis events, HTTP auth boundary, concurrent CRDT merge, replay safety, external edit conflict",
  );
} finally {
  if (api) await new Promise((resolve) => api.close(resolve));
  await events.close();
  await pool.end();
  await admin.query("DROP SCHEMA " + schema + " CASCADE");
  await admin.end();
}
