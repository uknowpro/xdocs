import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { wordSelections } from "../desktop/word-selection.mjs";

test("Word proposals require an unexpired unchanged capture and are single-use", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "word-proposal-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const id = randomUUID(),
    file = path.join(dir, id + ".xdocs-word.json");
  const session = wordSelections();
  const packet = {
    version: 1,
    id,
    name: "test.docx",
    text: "original",
    expires: Date.now() + 60000,
  };
  const store = (changes) =>
    writeFile(file, JSON.stringify({ ...packet, ...changes }));
  await store({ expires: Date.now() - 1 });
  await assert.rejects(session.capture(file), /만료/);
  await store({});
  const { handle } = await session.capture(file);
  await store({ text: "modified" });
  await assert.rejects(session.propose(handle, "edited"), /변경/);
  await store({});
  const results = await Promise.allSettled([
    session.propose(handle, "A"),
    session.propose(handle, "B"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    ["A", "B"].includes(
      JSON.parse(await readFile(path.join(dir, id + ".reply.json"), "utf8"))
        .text,
    ),
  );
  await assert.rejects(session.propose(handle, "again"), /다시 가져/);
});
