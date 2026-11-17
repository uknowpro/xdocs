import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { Vault } from "../desktop/store.mjs";
const count = Number(process.env.XDOCS_BENCH_NOTES || 5000),
  root = await mkdtemp(path.join(os.tmpdir(), "xdocs-benchmark-"));
let vault;
try {
  const padding = "본문 검증 ".repeat(1000);
  for (let i = 0; i < count; i++)
    await writeFile(
      path.join(root, `${i}.md`),
      `# 노트 ${i}\n\n[[노트 ${(i + 1) % count}]]\n\n${padding}`,
    );
  const start = performance.now();
  vault = await Vault.open(root, true);
  const openMs = performance.now() - start;
  const snapshot = vault.snapshot(),
    size = Buffer.byteLength(JSON.stringify(snapshot));
  assert.equal(snapshot.notes.length, count);
  assert.ok(snapshot.notes.every((n) => n.unloaded && n.body.length <= 240));
  assert.ok(size < count * 1500);
  assert.ok(vault.readNote(snapshot.notes[0].id).body.length > 5000);
  const refreshStart = performance.now();
  await vault.refresh();
  const refreshMs = performance.now() - refreshStart;
  const searchStart = performance.now();
  const matches = vault.search("본문 검증");
  const searchMs = performance.now() - searchStart;
  assert.ok(matches.length);
  console.log(
    JSON.stringify(
      {
        notes: count,
        openMs: Math.round(openMs),
        refreshMs: Math.round(refreshMs),
        searchMs: Math.round(searchMs),
        snapshotBytes: size,
        peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
      },
      null,
      2,
    ),
  );
} finally {
  vault?.close();
  await rm(root, { recursive: true, force: true });
}
