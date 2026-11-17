import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { OrganizationVault, validateServer } from "../desktop/organization.mjs";
function mockSession() {
  const docs = new Map(),
    operations = new Map();
  return {
    server: "https://example.invalid",
    principal: "test-user",
    offline: false,
    docs,
    async request(route, options) {
      if (this.offline) throw Error("offline");
      if (options?.method === "PUT") {
        const op = JSON.parse(options.body);
        if (operations.has(op.operationId))
          return operations.get(op.operationId);
        const current = docs.get(op.id);
        if ((current?.version || 0) !== op.baseVersion)
          throw Object.assign(Error("conflict"), { status: 409, current });
        const n = {
          id: op.id,
          title: op.body.match(/^# (.+)/)?.[1] || "노트",
          body: op.body,
          version: op.baseVersion + 1,
          deleted: op.deleted,
        };
        docs.set(n.id, n);
        operations.set(op.operationId, n);
        return n;
      }
      return { notes: [...docs.values()], next: null };
    },
  };
}
test("server URL validation only permits HTTPS or loopback HTTP", () => {
  assert.equal(
    validateServer("http://127.0.0.1:4242"),
    "http://127.0.0.1:4242",
  );
  assert.throws(() => validateServer("http://example.com"));
  assert.throws(() => validateServer("https://user:password@example.com"));
  assert.throws(() => validateServer("file:///tmp/a"));
});
test("outbox survives restart, syncs once and preserves conflicts", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "xdocs-sync-"));
  const session = mockSession(),
    workspace = { id: randomUUID(), name: "팀", role: "editor" };
  let v = await OrganizationVault.open(root, session, workspace);
  t.after(async () => {
    await v.close();
    await rm(root, { recursive: true, force: true });
  });
  const a = await v.create("노트", "# 노트\n\n오프라인");
  session.offline = true;
  await assert.rejects(v.sync(), /offline/);
  assert.equal((await v.snapshot()).pending, 1);
  await v.close();
  session.offline = false;
  v = await OrganizationVault.open(root, session, workspace);
  assert.equal((await v.snapshot()).pending, 0);
  assert.equal(session.docs.get(a.id).version, 1);
  let n = (await v.snapshot()).notes[0];
  await v.save({ ...n, body: "# 노트\n\n내 변경" });
  session.docs.set(a.id, {
    ...session.docs.get(a.id),
    body: "# 노트\n\n다른 사람 변경",
    version: 2,
  });
  await v.sync();
  assert.equal((await v.conflicts()).length, 1);
  assert.match((await v.snapshot()).notes[0].body, /내 변경/);
  await v.resolveConflict(a.id, "copy");
  await v.sync();
  assert.equal((await v.snapshot()).notes.length, 2);
  assert.ok((await v.snapshot()).notes.some((n) => n.body.includes("내 변경")));
  assert.ok(
    (await v.snapshot()).notes.some((n) => n.body.includes("다른 사람 변경")),
  );
});
test("reader cannot queue writes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "xdocs-reader-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = mockSession();
  const v = await OrganizationVault.open(root, session, {
    id: randomUUID(),
    name: "읽기",
    role: "reader",
  });
  await assert.rejects(v.create("불가"), /열람/);
  await v.close();
});

test("unsent organization data is isolated by account", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "xdocs-account-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = mockSession(),
    w = { id: randomUUID(), name: "팀", role: "editor" };
  const a = await OrganizationVault.open(root, session, w);
  await a.create("내 미전송 메모");
  await a.close();
  session.principal = "another-user";
  const b = await OrganizationVault.open(root, session, w);
  assert.equal((await b.snapshot()).notes.length, 0);
  await b.close();
});
