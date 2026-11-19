import { portableBackup } from "../desktop/portable-backup.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { Vault } from "../desktop/store.mjs";
test("portable backup reopens with preserved notes, attachments and history", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "portable-"));
  const vault = await Vault.open(path.join(root, "source"));
  try {
    const note = await vault.create("원본", "이전 내용");
    const saved = await vault.save({ ...note, body: "보관할 내용" });
    const src = path.join(root, "attachment.txt");
    await writeFile(src, "첨부");
    const attachment = await vault.addAttachment(src);
    await assert.rejects(vault.backup(vault.root), /바깥/);
    const backup = await vault.backup(root);
    await assert.rejects(
      readFile(path.join(backup.folder, ".xdocs", "index.sqlite")),
      { code: "ENOENT" },
    );
    const copy = await portableBackup(backup.folder, root, true);
    const restored = await Vault.open(copy.folder);
    try {
      assert.equal((await restored.readNote(note.id)).revision, saved.revision);
      assert.equal(
        (await restored.history(note.id)).length,
        (await vault.history(note.id)).length,
      );
      assert.equal(
        (await restored.readAttachment(attachment.path)).data,
        (await vault.readAttachment(attachment.path)).data,
      );
    } finally {
      restored.close();
    }
    await writeFile(path.join(backup.folder, attachment.path), "변경");
    await assert.rejects(
      portableBackup(backup.folder, root, true),
      /검증에 실패/,
    );
  } finally {
    vault.close();
    await rm(root, { recursive: true, force: true });
  }
});
