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
  copyFile,
} from "node:fs/promises";
import path from "node:path";

const digest = (text) => createHash("sha256").update(text).digest("hex");
const INDEX_VERSION = 1;
const MAX_NOTE_BYTES = 5 * 1024 * 1024;
const LEGACY_NOTE_CHARS = 5e6;
function checkNoteSize(raw) {
  if (Buffer.byteLength(raw, "utf8") > MAX_NOTE_BYTES)
    throw Error("노트 파일은 UTF-8 기준 5 MiB 이하로 저장할 수 있습니다.");
}
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
    body.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    path.basename(relative).replace(/\.md$/i, "");
  return {
    id: header?.[1] || digest(relative).slice(0, 32),
    title,
    body,
    path: relative,
    revision: digest(raw),
  };
}
import {portableBackup} from "./portable-backup.mjs";
export class Vault {
  constructor(root, db) {
    this.root = root;
    this.db = db;
  }
  static async open(root, metadataOnly = false) {
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
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version > INDEX_VERSION) {
      db.close();
      throw new Error(
        "더 새로운 앱에서 만든 색인입니다. 최신 버전으로 실행해 주세요.",
      );
    }
    db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, path TEXT UNIQUE NOT NULL, revision TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS note_metadata(id TEXT PRIMARY KEY,tags TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS links(source TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(source,target));
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(id UNINDEXED, title, body, tokenize='trigram');
      PRAGMA user_version=1;`);
    if (version === 0) db.exec("DELETE FROM notes; DELETE FROM links;");
    const vault = new Vault(root, db);
    vault.metadataOnly = metadataOnly;
    try {
      await vault.refresh();
    } catch (e) {
      db.close();
      throw e;
    }
    return vault;
  }
  backup(parent) {return portableBackup(this.root,parent);}
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
    const previous = new Map(
      this.db
        .prepare("SELECT id,path,revision FROM notes")
        .all()
        .map((n) => [n.id, n]),
    );
    const indexedMetadata = new Set(
      this.db
        .prepare("SELECT id FROM note_metadata")
        .all()
        .map((n) => n.id),
    );
    const ids = new Set();
    const scan = async (dir, depth = 0) => {
      if (depth > 20) return;
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await scan(full, depth + 1);
        else if (entry.isFile() && /\.md$/i.test(entry.name)) {
          const size = (await lstat(full)).size;
          // Older versions accepted up to five million UTF-16 code units.
          if (size > LEGACY_NOTE_CHARS * 3 + 64) continue;
          const n = decodeNote(
            await readFile(full, "utf8"),
            path.relative(this.root, full),
          );
          if (size > MAX_NOTE_BYTES && n.body.length > LEGACY_NOTE_CHARS)
            continue;
          if (ids.has(n.id))
            throw Error("중복된 노트 ID가 있습니다: " + n.path);
          ids.add(n.id);
          const old = previous.get(n.id);
          if (
            !old ||
            !indexedMetadata.has(n.id) ||
            old.revision !== n.revision ||
            old.path !== n.path
          )
            this.index(n);
          previous.delete(n.id);
        }
      }
    };
    this.db.exec("BEGIN");
    try {
      await scan(this.root);
      for (const id of previous.keys()) {
        this.db.prepare("DELETE FROM notes WHERE id=?").run(id);
        this.db.prepare("DELETE FROM note_metadata WHERE id=?").run(id);
        this.db.prepare("DELETE FROM links WHERE source=?").run(id);
        this.db.prepare("DELETE FROM notes_fts WHERE id=?").run(id);
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return this.snapshot();
  }
  index(n) {
    this.db
      .prepare("INSERT OR REPLACE INTO note_metadata VALUES(?,?)")
      .run(
        n.id,
        JSON.stringify([
          ...new Set(
            [
              ...n.body
                .replace(/```[\s\S]*?```/g, "")
                .matchAll(/(?:^|\s)#([^\s#]+)/g),
            ].map((m) => m[1]),
          ),
        ]),
      );
    this.db.prepare("DELETE FROM notes_fts WHERE id=?").run(n.id);
    this.db
      .prepare("INSERT INTO notes_fts(id,title,body) VALUES(?,?,?)")
      .run(n.id, n.title, n.body);
    this.db
      .prepare("INSERT OR REPLACE INTO notes VALUES (?, ?, ?, ?, ?)")
      .run(n.id, n.title, n.body, n.path, n.revision);
    this.db.prepare("DELETE FROM links WHERE source=?").run(n.id);
    for (const target of linksIn(n.body))
      this.db
        .prepare("INSERT OR IGNORE INTO links VALUES (?, ?)")
        .run(n.id, target);
  }
  readNote(id) {
    const note = this.db.prepare("SELECT * FROM notes WHERE id=?").get(id);
    if (!note) throw Error("노트를 찾을 수 없습니다.");
    return note;
  }
  snapshot() {
    if (this.metadataOnly) {
      const links = new Map();
      for (const row of this.db
        .prepare("SELECT source,target FROM links")
        .iterate()) {
        const values = links.get(row.source) || [];
        values.push(row.target);
        links.set(row.source, values);
      }
      return {
        root: this.root,
        name: path.basename(this.root),
        notes: Array.from(
          this.db
            .prepare(
              "SELECT n.id,n.title,n.path,n.revision,substr(n.body,1,240) AS body,(instr(char(10)||n.body,char(10)||'```xdocs-architecture')>0 OR instr(char(10)||n.body,char(10)||'```xdocs-workflow')>0) AS canvas,(instr(char(10)||n.body,char(10)||'```xdocs-sheets')>0) AS sheet,m.tags FROM notes n LEFT JOIN note_metadata m ON m.id=n.id ORDER BY n.title COLLATE NOCASE",
            )
            .iterate(),
          (n) => ({
            ...n,
            body: n.body,
            tags: JSON.parse(n.tags || "[]"),
            unloaded: true,
            links: links.get(n.id) || [],
          }),
        ),
      };
    }
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
      (body !== undefined && typeof body !== "string")
    )
      throw new Error("올바르지 않은 노트입니다.");
    const id = randomUUID();
    const filename =
      (title
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
        .replace(/^\.+/, "")
        .replace(/[. ]+$/g, "")
        .slice(0, 70) || "note") +
      "-" +
      id.slice(0, 8) +
      ".md";
    const text = `<!-- xdocs:id=${id} -->\n${body ?? "# " + title + "\n\n"}`;
    checkNoteSize(text);
    await writeFile(path.join(this.root, filename), text, { flag: "wx" });
    const note = decodeNote(text, filename);
    this.index(note);
    return note;
  }
  async save({ id, body, revision }) {
    if (
      typeof id !== "string" ||
      typeof body !== "string" ||
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
    checkNoteSize(raw);
    await this.recordHistory(prior, original);
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
    const trash = await this.internalDir("trash");
    const metadata = await this.internalDir("trash-paths");
    const token = randomUUID() + "-" + path.basename(file);
    const record = path.join(metadata, token.slice(0, 36) + ".json");
    await writeFile(
      record,
      JSON.stringify({ path: note.path, deletedAt: new Date().toISOString() }),
      { flag: "wx" },
    );
    try {
      await rename(file, path.join(trash, token));
    } catch (error) {
      await unlink(record);
      throw error;
    }
    this.db.prepare("DELETE FROM notes WHERE id=?").run(id);
    this.db.prepare("DELETE FROM note_metadata WHERE id=?").run(id);
    this.db.prepare("DELETE FROM links WHERE source=?").run(id);
    this.db.prepare("DELETE FROM notes_fts WHERE id=?").run(id);
  }
  async internalDir(...parts) {
    let folder = this.root;
    for (const part of [".xdocs", ...parts]) {
      if (!/^[a-zA-Z0-9_-]+$/.test(part) && part !== ".xdocs")
        throw new Error("허용되지 않은 내부 경로입니다.");
      folder = path.join(folder, part);
      await mkdir(folder, { recursive: true });
      if ((await lstat(folder)).isSymbolicLink())
        throw new Error("내부 폴더 링크는 지원하지 않습니다.");
    }
    return folder;
  }
  async recordHistory(note, raw) {
    const folder = await this.internalDir("history", note.id);
    const filename = note.revision + ".json";
    try {
      await writeFile(
        path.join(folder, filename),
        JSON.stringify({
          title: note.title,
          path: note.path,
          body: decodeNote(raw, note.path).body,
          savedAt: new Date().toISOString(),
          revision: note.revision,
        }),
        { flag: "wx" },
      );
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  async history(id) {
    if (!this.db.prepare("SELECT id FROM notes WHERE id=?").get(id))
      throw new Error("노트를 찾을 수 없습니다.");
    const folder = await this.internalDir("history", id);
    const entries = [];
    for (const item of await readdir(folder, { withFileTypes: true })) {
      if (!item.isFile() || !/^[a-f0-9]{64}\.json$/.test(item.name)) continue;
      entries.push(
        JSON.parse(await readFile(path.join(folder, item.name), "utf8")),
      );
    }
    return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
  async restoreHistory({ id, revision, historyRevision }) {
    const snapshot = (await this.history(id)).find(
      (n) => n.revision === historyRevision,
    );
    if (!snapshot) throw new Error("변경 이력을 찾을 수 없습니다.");
    return this.save({ id, revision, body: snapshot.body });
  }
  async listTrash() {
    const folder = await this.internalDir("trash");
    const entries = [];
    const metadata = await this.internalDir("trash-paths");
    for (const item of await readdir(folder, { withFileTypes: true })) {
      if (!item.isFile() || !/^[a-f0-9-]{36}-.+\.md$/i.test(item.name))
        continue;
      const record = path.join(metadata, item.name.slice(0, 36) + ".json");
      let originalPath = item.name.slice(37);
      let deletedAt;
      try {
        const info = JSON.parse(await readFile(record, "utf8"));
        originalPath = info.path;
        deletedAt = info.deletedAt;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const file = path.join(folder, item.name);
      entries.push({
        ...decodeNote(await readFile(file, "utf8"), originalPath),
        token: item.name,
        deletedAt: deletedAt ?? (await lstat(file)).mtime.toISOString(),
      });
    }
    return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }
  async restoreTrash(token) {
    const n = (await this.listTrash()).find((n) => n.token === token);
    if (!n) throw new Error("휴지통 항목을 찾을 수 없습니다.");
    if (this.db.prepare("SELECT id FROM notes WHERE id=?").get(n.id))
      throw new Error("같은 ID의 노트가 이미 존재합니다.");
    const filename = n.path;
    const full = path.resolve(this.root, filename);
    if (
      !full.startsWith(this.root + path.sep) ||
      path.isAbsolute(filename) ||
      filename.split(/[\\/]/).some((part) => part.startsWith(".")) ||
      !/\.md$/i.test(filename)
    )
      throw Error("원래 노트 경로를 확인해 주세요.");
    let parent = this.root;
    for (const part of path
      .relative(this.root, path.dirname(full))
      .split(path.sep)
      .filter(Boolean)) {
      parent = path.join(parent, part);
      await mkdir(parent, { recursive: true });
      if ((await realpath(parent)) !== parent)
        throw Error("복원 대상 폴더의 경로를 확인해 주세요.");
    }
    const raw = await readFile(
      path.join(this.root, ".xdocs", "trash", token),
      "utf8",
    );
    try {
      await writeFile(full, raw, { flag: "wx" });
    } catch (error) {
      if (error.code === "EEXIST")
        throw Error(
          "같은 경로에 파일이 있습니다. 이름을 변경한 뒤 복원하세요.",
        );
      throw error;
    }
    const restored = decodeNote(raw, filename);
    this.index(restored);
    await unlink(path.join(this.root, ".xdocs", "trash", token));
    const metadata = await this.internalDir("trash-paths");
    await unlink(path.join(metadata, token.slice(0, 36) + ".json")).catch(
      (error) => {
        if (error.code !== "ENOENT") throw error;
      },
    );
    return restored;
  }
  async addAttachment(source) {
    const extensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".pdf",
      ".xlsx",
      ".xlsm",
      ".xls",
      ".xlsb",
      ".csv",
      ".tsv",
      ".txt",
    ];
    const ext = path.extname(source).toLowerCase();
    if (!extensions.includes(ext))
      throw new Error("이미지 또는 PDF를 선택해 주세요.");
    if ((await lstat(source)).size > 25 * 1024 * 1024)
      throw new Error("첨부파일은 25 MB 이하만 지원합니다.");
    const folder = path.join(this.root, "assets");
    await mkdir(folder, { recursive: true });
    if ((await lstat(folder)).isSymbolicLink())
      throw new Error("첨부 폴더 링크는 지원하지 않습니다.");
    const filename = randomUUID() + ext;
    await copyFile(source, path.join(folder, filename), 1);
    return {
      path: "assets/" + filename,
      name: path.basename(source),
      kind:
        ext === ".pdf"
          ? "pdf"
          : [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)
            ? "image"
            : "file",
    };
  }
  async readAttachment(relative) {
    if (
      typeof relative !== "string" ||
      !/^assets\/[a-f0-9-]{36}\.(png|jpe?g|webp|gif|pdf|xlsx|xlsm|xls|xlsb|csv|tsv|txt)$/i.test(
        relative,
      )
    )
      throw new Error("허용되지 않은 첨부 경로입니다.");
    const file = path.join(this.root, relative);
    if ((await realpath(file)) !== file)
      throw new Error("첨부 링크는 지원하지 않습니다.");
    if ((await lstat(file)).size > 25 * 1024 * 1024)
      throw new Error("첨부파일 크기 제한을 초과했습니다.");
    const mime =
      {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
      }[path.extname(file).toLowerCase()] || "application/octet-stream";
    return { mime, data: (await readFile(file)).toString("base64") };
  }
  search(query) {
    if (typeof query !== "string" || query.length > 300)
      throw new Error("검색어가 너무 깁니다.");
    if (this.metadataOnly) {
      const term = "%" + query.replace(/[\\%_]/g, "\\$&") + "%";
      const rows =
        query.length >= 3 && !/[\\%_]/.test(query)
          ? this.db
              .prepare(
                "SELECT n.id,n.title,n.path,n.revision,substr(n.body,1,240) AS body FROM notes n JOIN notes_fts f ON n.id=f.id WHERE f.title LIKE ? OR f.body LIKE ? ORDER BY n.title LIMIT 200",
              )
              .all(term, term)
          : this.db
              .prepare(
                "SELECT id,title,path,revision,substr(body,1,240) AS body FROM notes WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' ORDER BY title LIMIT 200",
              )
              .all(term, term);
      return rows.map((n) => ({ ...n, unloaded: true }));
    }
    const term = "%" + query.replace(/[\\%_]/g, "\\$&") + "%";
    if (query.length >= 3 && !/[\\%_]/.test(query)) {
      return this.db
        .prepare(
          `SELECT n.* FROM notes n JOIN notes_fts f ON n.id=f.id WHERE f.title LIKE ? OR f.body LIKE ? ORDER BY n.title LIMIT 200`,
        )
        .all(term, term);
    }
    return this.db
      .prepare(
        "SELECT * FROM notes WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' ORDER BY title LIMIT 200",
      )
      .all(term, term);
  }
}
