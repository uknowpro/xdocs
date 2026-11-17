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
