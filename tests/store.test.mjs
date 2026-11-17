import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  symlink,
  mkdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Vault, linksIn } from "../desktop/store.mjs";
async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "xdocs-test-"));
  const vault = await Vault.open(root);
  t.after(async () => {
    vault.close();
    await rm(root, { recursive: true, force: true });
  });
  return { root, vault };
}
test("Markdown files are canonical and survive SQLite index rebuild", async (t) => {
  const { root, vault } = await setup(t);
  const note = await vault.create("한글 노트", "# 한글 노트\n\n[[연결 노트]]");
  const saved = await vault.save({
    ...note,
    body: "# 제목 변경\n\n**안녕하세요**",
  });
  assert.equal(saved.id, note.id);
  assert.equal(saved.title, "제목 변경");
  assert.match(
    await readFile(path.join(root, note.path), "utf8"),
    /안녕하세요/,
  );
  vault.db.exec("DELETE FROM notes");
  assert.equal((await vault.refresh()).notes[0].body, saved.body);
  assert.equal(vault.search("안녕").length, 1);
  assert.equal(vault.search("%").length, 0);
});
test("external changes cannot be overwritten", async (t) => {
  const { root, vault } = await setup(t);
  const note = await vault.create("원본");
  await writeFile(path.join(root, note.path), "# 외부 변경");
  await assert.rejects(vault.save({ ...note, body: "# 앱 변경" }), /외부/);
  assert.equal(
    await readFile(path.join(root, note.path), "utf8"),
    "# 외부 변경",
  );
});
test("trash keeps original file and removes it from the index", async (t) => {
  const { root, vault } = await setup(t);
  const note = await vault.create("삭제");
  await vault.trash(note);
  assert.equal(vault.snapshot().notes.length, 0);
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(path.join(root, ".xdocs/trash"));
  assert.equal(files.length, 1);
  assert.match(
    await readFile(path.join(root, ".xdocs/trash", files[0]), "utf8"),
    /# 삭제/,
  );
});
test("external Markdown and nested folders are indexed without rewriting", async (t) => {
  const { root, vault } = await setup(t);
  await mkdir(path.join(root, "연구"));
  await writeFile(path.join(root, "연구", "노트.md"), "# 기존 문서\n\n본문");
  const n = (await vault.refresh()).notes[0];
  await vault.save({ ...n, body: "# 기존 문서\n\n수정" });
  assert.equal(
    await readFile(path.join(root, n.path), "utf8"),
    "# 기존 문서\n\n수정",
  );
});
test("path traversal and symbolic links are rejected", async (t) => {
  const { root, vault } = await setup(t);
  await assert.rejects(vault.safe("../outside.md"), /경로/);
  await writeFile(path.join(root, "target.md"), "# 대상");
  await symlink(path.join(root, "target.md"), path.join(root, "link.md"));
  await assert.rejects(vault.safe("link.md"), /링크/);
  assert.equal((await vault.refresh()).notes.length, 1);
});
test("duplicate note IDs do not destroy existing index", async (t) => {
  const { root, vault } = await setup(t);
  const n = await vault.create("원본");
  await writeFile(
    path.join(root, "copy.md"),
    await readFile(path.join(root, n.path)),
  );
  await assert.rejects(vault.refresh(), /중복/);
  assert.equal(vault.snapshot().notes.length, 1);
});
test("links ignore fenced code and preserve aliases", () => {
  assert.deepEqual(linksIn("[[노트|표시]] [[노트]]\n```\n[[코드]]\n```"), [
    "노트",
  ]);
});

test("v0.1 vault upgrades without rewriting notes and survives reopening", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "xdocs-upgrade-"));
  let vault;
  t.after(async () => {
    vault?.close();
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, ".xdocs"));
  const { DatabaseSync } = await import("node:sqlite");
  const old = new DatabaseSync(path.join(root, ".xdocs/index.sqlite"));
  old.exec(
    "CREATE TABLE notes(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,path TEXT UNIQUE NOT NULL,revision TEXT NOT NULL); CREATE TABLE links(source TEXT NOT NULL,target TEXT NOT NULL,PRIMARY KEY(source,target));",
  );
  old.close();
  const raw =
    "<!-- xdocs:id=550e8400-e29b-41d4-a716-446655440000 -->\n# 기존 데이터\n\n한글 보존 [[대상]]";
  await writeFile(path.join(root, "note.md"), raw);
  vault = await Vault.open(root);
  assert.equal(
    vault.snapshot().notes[0].id,
    "550e8400-e29b-41d4-a716-446655440000",
  );
  assert.equal(vault.search("한글 보존").length, 1);
  assert.equal(await readFile(path.join(root, "note.md"), "utf8"), raw);
  vault.close();
  vault = await Vault.open(root);
  assert.equal(
    vault.snapshot().notes[0].body,
    raw.split("\n").slice(1).join("\n"),
  );
  assert.equal(vault.db.prepare("PRAGMA user_version").get().user_version, 1);
});
test("history restore preserves the version replaced, trash restore preserves IDs", async (t) => {
  const { root, vault } = await setup(t);
  const a = await vault.create("이력", "# 이력\n\n첫 번째");
  const b = await vault.save({ ...a, body: "# 이력\n\n두 번째" });
  const h = await vault.history(a.id);
  assert.equal(h.length, 1);
  const c = await vault.restoreHistory({
    id: a.id,
    revision: b.revision,
    historyRevision: h[0].revision,
  });
  assert.equal(c.body, a.body);
  assert.equal((await vault.history(a.id)).length, 2);
  await vault.trash(c);
  const items = await vault.listTrash();
  const restored = await vault.restoreTrash(items[0].token);
  assert.equal(restored.id, a.id);
  assert.equal(restored.body, a.body);
  assert.equal((await vault.listTrash()).length, 0);
});
test("attachments are copied locally and only allowed paths can be read", async (t) => {
  const { root, vault } = await setup(t);
  const file = path.join(root, "sample.pdf");
  await writeFile(file, "%PDF-1.4\n");
  const a = await vault.addAttachment(file);
  assert.equal(a.kind, "pdf");
  assert.equal((await vault.readAttachment(a.path)).mime, "application/pdf");
  await assert.rejects(vault.readAttachment("../sample.pdf"), /경로/);
});
test("a newer index version is rejected without changing the Markdown source", async (t) => {
  const { root, vault } = await setup(t);
  const a = await vault.create("호환성");
  vault.db.exec("PRAGMA user_version=999");
  await assert.rejects(Vault.open(root), /최신/);
  assert.match(await readFile(path.join(root, a.path), "utf8"), /# 호환성/);
});
