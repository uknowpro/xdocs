import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  readFile,
  writeFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rename,
  rm,
} from "node:fs/promises";

async function digest(file) {
  const hash = createHash("sha256");
  for await (const part of createReadStream(file)) hash.update(part);
  return hash.digest("hex");
}
async function contents(root, prefix = "") {
  const files = [];
  for (const e of await readdir(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const name = prefix ? prefix + "/" + e.name : e.name;
    if (e.name.startsWith(".") && ![".xdocs", ".claude"].includes(name))
      continue;
    if (
      prefix === ".xdocs" &&
      !["history", "trash", "trash-paths"].includes(e.name)
    )
      continue;
    if (prefix === ".claude" && e.name !== "skills") continue;
    if (e.isDirectory()) files.push(...(await contents(root, name)));
    else if (
      e.isFile() &&
      (/\.md$/i.test(name) || /^(assets|\.xdocs|\.claude\/skills)\//.test(name))
    )
      files.push(name);
  }
  return files.sort();
}
export async function portableBackup(root, parent, restore = false) {
  root = await realpath(root);
  parent = await realpath(parent);
  const rel = path.relative(root, parent);
  if (
    !rel ||
    (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))
  )
    throw Error("워크스페이스 바깥의 폴더를 선택하세요.");
  const temp = await mkdtemp(path.join(parent, ".xdocs-backup-"));
  try {
    const files = await contents(root),
      hashes = [];
    for (const name of files) {
      const source = path.join(root, name),
        dest = path.join(temp, name);
      if ((await realpath(source)) !== source)
        throw Error("백업 중 파일 경로가 변경되었습니다.");
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(source, dest);
      hashes.push(await digest(dest));
    }
    if (JSON.stringify(await contents(root)) !== JSON.stringify(files))
      throw Error("백업 중 파일 목록이 변경되었습니다. 다시 시도하세요.");
    for (const [i, name] of files.entries())
      if ((await digest(path.join(root, name))) !== hashes[i])
        throw Error("백업 중 파일이 변경되었습니다. 다시 시도하세요.");
    const manifest = {
      version: 1,
      files: files.map((name, i) => ({ name, sha256: hashes[i] })),
    };
    if (restore) {
      const file = path.join(root, ".xdocs", "backup-manifest.json");
      const info = await lstat(file);
      if (
        !info.isFile() || (await realpath(file)) !== file ||
        info.size > 32 * 1024 * 1024
      )
        throw Error("백업 목록 파일을 확인하세요.");
      const recorded = JSON.parse(await readFile(file, "utf8"));
      if (
        recorded.version !== 1 ||
        JSON.stringify(recorded.files) !== JSON.stringify(manifest.files)
      )
        throw Error("백업 이후 파일이 변경되어 복원 검증에 실패했습니다.");
    } else {
      await mkdir(path.join(temp, ".xdocs"), { recursive: true });
      await writeFile(
        path.join(temp, ".xdocs", "backup-manifest.json"),
        JSON.stringify(manifest),
      );
    }
    const folder = path.join(
      parent,
      (restore ? "xdocs-restored-" : "xdocs-backup-") +
        new Date().toISOString().slice(0, 10) +
        "-" +
        randomUUID().slice(0, 8),
    );
    await rename(temp, folder);
    return { folder, count: files.length };
  } catch (e) {
    await rm(temp, { recursive: true, force: true });
    throw e;
  }
}
