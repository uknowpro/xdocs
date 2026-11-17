import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  lstat,
  realpath,
  open,
  unlink,
} from "node:fs/promises";
import path from "node:path";

const digest = (text) => createHash("sha256").update(text).digest("hex");
const UUID = /^[a-f0-9-]{36}$/i;
export function linksIn(body) {
  return [
    ...new Set(
      [...body.replace(/```[\s\S]*?```/g, "").matchAll(/\[\[([^\]\n]+)\]\]/g)]
        .map((m) => m[1].split("|")[0].trim())
        .filter(Boolean),
    ),
  ];
}
export function decodeNote(raw, relative) {
  const header = raw.match(/^<!-- xdocs:id=([a-f0-9-]{36}) -->\r?\n/i);
  const body = header ? raw.slice(header[0].length) : raw;
  const title =
    body.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(relative, ".md");
  return {
    id: header?.[1] || digest(relative).slice(0, 32),
    title,
    body,
    path: relative,
    revision: digest(raw),
  };
}
export class Vault {
  constructor(root, db) {
    this.root = root;
    this.db = db;
  }
  static async open(root) {
    await mkdir(root, { recursive: true });
    root = await realpath(root);
    const hidden = path.join(root, ".xdocs");
    await mkdir(hidden, { recursive: true });
    if ((await lstat(hidden)).isSymbolicLink())
      throw new Error("보관함 설정 폴더는 심볼릭 링크일 수 없습니다.");
    const indexPath = path.join(hidden, "index.sqlite");
    try {
      if ((await lstat(indexPath)).isSymbolicLink())
        throw new Error("색인 파일 링크를 사용할 수 없습니다.");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const db = new DatabaseSync(indexPath);
    db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, path TEXT UNIQUE NOT NULL, revision TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS links(source TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(source,target));`);
    const vault = new Vault(root, db);
    try {
      await vault.refresh();
    } catch (e) {
      db.close();
      throw e;
    }
    return vault;
  }
  close() {
    this.db.close();
  }
  async safe(relative) {
    if (
      typeof relative !== "string" ||
      path.isAbsolute(relative) ||
      relative.split(/[\\/]/).some((p) => p === ".." || p === ".xdocs") ||
      !relative.toLowerCase().endsWith(".md")
    )
      throw new Error("허용되지 않은 노트 경로입니다.");
    const full = path.resolve(this.root, relative);
    if (!full.startsWith(this.root + path.sep))
      throw new Error("보관함 바깥 경로입니다.");
    const actual = await realpath(full);
    if (actual !== full)
      throw new Error("노트 심볼릭 링크는 지원하지 않습니다.");
    return full;
  }
  async refresh() {
    const found = [];
    const scan = async (dir, depth = 0) => {
      if (depth > 20) return;
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await scan(full, depth + 1);
        else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          const stat = await lstat(full);
          if (stat.size > 5 * 1024 * 1024) continue;
          found.push(
            decodeNote(
              await readFile(full, "utf8"),
              path.relative(this.root, full),
            ),
          );
        }
      }
    };
    await scan(this.root);
    const ids = new Set();
    for (const n of found) {
      if (ids.has(n.id))
        throw new Error("중복된 노트 ID가 있습니다: " + n.path);
      ids.add(n.id);
    }
    this.db.exec("BEGIN");
    try {
      this.db.exec("DELETE FROM notes; DELETE FROM links;");
      for (const n of found) this.index(n);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return this.snapshot();
  }
  index(n) {
    this.db
      .prepare("INSERT OR REPLACE INTO notes VALUES (?, ?, ?, ?, ?)")
      .run(n.id, n.title, n.body, n.path, n.revision);
    this.db.prepare("DELETE FROM links WHERE source=?").run(n.id);
    for (const target of linksIn(n.body))
      this.db
        .prepare("INSERT OR IGNORE INTO links VALUES (?, ?)")
        .run(n.id, target);
  }
  snapshot() {
    return {
      root: this.root,
      name: path.basename(this.root),
      notes: this.db
        .prepare("SELECT * FROM notes ORDER BY title COLLATE NOCASE")
        .all(),
    };
  }
  async create(title = "새 노트", body) {
    if (
      typeof title !== "string" ||
      title.length > 200 ||
      (body !== undefined && (typeof body !== "string" || body.length > 5e6))
    )
      throw new Error("올바르지 않은 노트입니다.");
    const id = randomUUID();
    const filename =
      (title
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
        .replace(/[. ]+$/g, "")
        .slice(0, 70) || "note") +
      "-" +
      id.slice(0, 8) +
      ".md";
    const text = `<!-- xdocs:id=${id} -->\n${body ?? "# " + title + "\n\n"}`;
    await writeFile(path.join(this.root, filename), text, { flag: "wx" });
    const note = decodeNote(text, filename);
    this.index(note);
    return note;
  }
  async save({ id, body, revision }) {
    if (
      typeof id !== "string" ||
      typeof body !== "string" ||
      body.length > 5e6 ||
      typeof revision !== "string"
    )
      throw new Error("올바르지 않은 저장 요청입니다.");
    const prior = this.db.prepare("SELECT * FROM notes WHERE id=?").get(id);
    if (!prior) throw new Error("노트를 찾을 수 없습니다. 새로고침해 주세요.");
    const full = await this.safe(prior.path);
    const original = await readFile(full, "utf8");
    if (digest(original) !== revision)
      throw new Error(
        "외부에서 파일이 변경되었습니다. 내용을 복사하거나 충돌 사본으로 저장한 뒤 새로고침해 주세요.",
      );
    const raw = UUID.test(id) ? `<!-- xdocs:id=${id} -->\n${body}` : body;
    const temporary = full + ".xdocs-" + randomUUID() + ".tmp";
    try {
      const file = await open(temporary, "wx");
      try {
        await file.writeFile(raw);
        await file.sync();
      } finally {
        await file.close();
      }
      if (digest(await readFile(full, "utf8")) !== revision)
        throw new Error(
          "저장 중 외부 변경을 발견했습니다. 충돌 사본으로 저장해 주세요.",
        );
      await rename(temporary, full);
    } finally {
      await unlink(temporary).catch(() => {});
    }
    const note = decodeNote(raw, prior.path);
    this.index(note);
    return note;
  }
  async trash({ id, revision }) {
    const note = this.db.prepare("SELECT * FROM notes WHERE id=?").get(id);
    if (!note) throw new Error("노트를 찾을 수 없습니다.");
    const file = await this.safe(note.path);
    if (digest(await readFile(file, "utf8")) !== revision)
      throw new Error("외부 변경을 먼저 확인해 주세요.");
    const trash = path.join(this.root, ".xdocs", "trash");
    await mkdir(trash, { recursive: true });
    if ((await lstat(trash)).isSymbolicLink())
      throw new Error("휴지통 링크를 사용할 수 없습니다.");
    await rename(
      file,
      path.join(trash, randomUUID() + "-" + path.basename(file)),
    );
    this.db.prepare("DELETE FROM notes WHERE id=?").run(id);
    this.db.prepare("DELETE FROM links WHERE source=?").run(id);
  }
  search(query) {
    if (typeof query !== "string" || query.length > 300)
      throw new Error("검색어가 너무 깁니다.");
    const term = "%" + query.replace(/[\\%_]/g, "\\$&") + "%";
    return this.db
      .prepare(
        "SELECT * FROM notes WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' ORDER BY title",
      )
      .all(term, term);
  }
}
