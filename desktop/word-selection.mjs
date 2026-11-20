import { open, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function wordSelections() {
  const pending = new Map();
  function prune() {
    for (const [handle, item] of pending)
      if (item.expires <= Date.now()) pending.delete(handle);
  }
  async function readRequest(file) {
    const match =
      /^([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.xdocs-word\.json$/i.exec(
        path.basename(file),
      );
    if (!match) throw Error("Word 도우미가 만든 선택 영역 파일을 고르세요.");
    const fd = await open(file, "r");
    try {
      const stat = await fd.stat();
      if (!stat.isFile() || stat.size > 400000)
        throw Error("Word 선택 영역 파일 크기를 확인하세요.");
      const data = JSON.parse(await fd.readFile("utf8"));
      if (
        data.version !== 1 ||
        data.id !== match[1] ||
        typeof data.name !== "string" ||
        data.name.length > 260 ||
        typeof data.text !== "string" ||
        !data.text.trim() ||
        data.text.length > 50000 ||
        !Number.isSafeInteger(data.expires) ||
        data.expires <= Date.now() ||
        data.expires > Date.now() + 31 * 60 * 1000
      )
        throw Error("선택 영역이 만료되었거나 형식이 올바르지 않습니다.");
      return data;
    } finally {
      await fd.close();
    }
  }
  return {
    async capture(file) {
      prune();
      const data = await readRequest(file);
      const handle = randomUUID();
      pending.set(handle, {
        file,
        expires: data.expires,
        id: data.id,
        text: data.text,
      });
      return { handle, name: data.name, text: data.text };
    },
    async propose(handle, text) {
      prune();
      const entry = pending.get(handle);
      if (!entry) throw Error("Word 선택 영역을 다시 가져오세요.");
      if (
        typeof text !== "string" ||
        !text.trim() ||
        text.length > 50000 ||
        /[\x00-\x08\x0e-\x1f]/.test(text)
      )
        throw Error("수정안은 5만 자 이하의 일반 텍스트로 입력하세요.");
      const data = await readRequest(entry.file);
      if (data.text !== entry.text)
        throw Error("Word 선택 영역이 변경되었습니다.");
      const base = path.join(path.dirname(entry.file), entry.id);
      await writeFile(
        base + ".reply.json",
        JSON.stringify({ id: entry.id, text }),
        { flag: "wx", mode: 0o600 },
      );
      try {
        await writeFile(base + ".ready", "", { flag: "wx", mode: 0o600 });
      } catch (error) {
        await unlink(base + ".reply.json");
        throw error;
      }
      pending.delete(handle);
    },
  };
}
