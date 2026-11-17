import { collaborationBody } from "../shared/collab-blocks.mjs";
import * as Y from "yjs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import * as oidc from "openid-client";
export function validateServer(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  )
    throw Error("서버의 기본 주소만 입력해 주세요.");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname)
    )
  )
    throw Error("HTTPS 주소 또는 로컬 개발 서버만 연결할 수 있습니다.");
  return url.origin;
}
function trustedEndpoint(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname)
    )
  )
    throw Error("안전하지 않은 인증 주소입니다.");
  return url;
}
export class OrganizationSession {
  constructor({ directory, safeStorage, openExternal }) {
    this.directory = directory;
    this.safeStorage = safeStorage;
    this.openExternal = openExternal;
    this.tokens = null;
    this.server = null;
    this.configuration = null;
    this.refreshing = null;
  }
  async configure(server) {
    this.server = validateServer(server);
    const response = await fetch(this.server + "/v1/identity", {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("조직 서버 설정을 읽을 수 없습니다.");
    const identity = await response.json();
    const issuer = trustedEndpoint(identity.issuer);
    this.identity = identity;
    this.configuration = await oidc.discovery(
      issuer,
      identity.clientId,
      undefined,
      oidc.None(),
      {
        execute:
          issuer.protocol === "http:" ? [oidc.allowInsecureRequests] : [],
      },
    );
    const metadata = this.configuration.serverMetadata();
    for (const name of ["authorization_endpoint", "token_endpoint", "jwks_uri"])
      if (metadata[name]) trustedEndpoint(metadata[name]);
  }
  tokenPath() {
    return path.join(
      this.directory,
      createHash("sha256").update(this.server).digest("hex") + ".tokens",
    );
  }
  async persist() {
    await mkdir(this.directory, { recursive: true });
    if (
      this.safeStorage.isEncryptionAvailable() &&
      this.safeStorage.getSelectedStorageBackend?.() !== "basic_text"
    )
      await writeFile(
        this.tokenPath(),
        this.safeStorage.encryptString(JSON.stringify(this.tokens)),
        { mode: 0o600 },
      );
  }
  async login(server) {
    await this.configure(server);
    try {
      if (
        this.safeStorage.isEncryptionAvailable() &&
        this.safeStorage.getSelectedStorageBackend?.() !== "basic_text"
      ) {
        this.tokens = JSON.parse(
          this.safeStorage.decryptString(await readFile(this.tokenPath())),
        );
        await this.accessToken();
        return this.list();
      }
    } catch {
      this.tokens = null;
    }
    const verifier = oidc.randomPKCECodeVerifier(),
      challenge = await oidc.calculatePKCECodeChallenge(verifier),
      state = oidc.randomState(),
      nonce = oidc.randomNonce();
    const redirect = "http://127.0.0.1:43821/callback";
    const callback = await new Promise(async (resolve, reject) => {
      let timer;
      const listener = createServer((req, res) => {
        const current = new URL(req.url, redirect);
        if (
          current.pathname !== "/callback" ||
          current.searchParams.get("state") !== state
        ) {
          res.writeHead(400);
          res.end("Invalid callback");
          return;
        }
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end("xdocs 로그인 응답을 받았습니다. 앱으로 돌아가세요.");
        clearTimeout(timer);
        listener.close();
        resolve(current);
      });
      listener.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      listener.listen(43821, "127.0.0.1", async () => {
        timer = setTimeout(() => {
          listener.close();
          reject(Error("로그인 시간이 초과되었습니다."));
        }, 180000);
        try {
          const url = oidc.buildAuthorizationUrl(this.configuration, {
            redirect_uri: redirect,
            scope: this.identity.scope || "openid profile",
            code_challenge: challenge,
            code_challenge_method: "S256",
            state,
            nonce,
          });
          trustedEndpoint(url.href);
          await this.openExternal(url.href);
        } catch (e) {
          clearTimeout(timer);
          listener.close();
          reject(e);
        }
      });
    });
    const tokens = await oidc.authorizationCodeGrant(
      this.configuration,
      callback,
      {
        pkceCodeVerifier: verifier,
        expectedState: state,
        expectedNonce: nonce,
      },
    );
    this.tokens = {
      ...tokens,
      expiresAt: Date.now() + (tokens.expires_in || 300) * 1000,
    };
    await this.persist();
    return this.list();
  }
  async accessToken() {
    if (!this.tokens) throw Error("SSO 로그인이 필요합니다.");
    if (this.tokens.expiresAt > Date.now() + 30000)
      return this.tokens.access_token;
    if (this.refreshing) return this.refreshing;
    if (!this.tokens.refresh_token) throw Error("다시 로그인해 주세요.");
    this.refreshing = (async () => {
      const next = await oidc.refreshTokenGrant(
        this.configuration,
        this.tokens.refresh_token,
      );
      this.tokens = {
        ...this.tokens,
        ...next,
        expiresAt: Date.now() + (next.expires_in || 300) * 1000,
      };
      await this.persist();
      return this.tokens.access_token;
    })();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }
  async request(route, options = {}) {
    const token = await this.accessToken();
    const response = await fetch(this.server + route, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...options.headers,
        authorization: "Bearer " + token,
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(Error(data.error || "서버 요청 실패"), {
        status: response.status,
        current: data.current,
      });
    return data;
  }
  async list() {
    const me = await this.request("/v1/me");
    this.principal = me.principal;
    return this.request("/v1/workspaces");
  }
  async logout() {
    if (this.server) await unlink(this.tokenPath()).catch(() => {});
    this.tokens = null;
    this.principal = null;
  }
}
export class OrganizationVault {
  constructor(db, session, workspace) {
    this.db = db;
    this.session = session;
    this.workspace = workspace;
    this.inflight = null;
  }
  static async open(directory, session, workspace) {
    await mkdir(directory, { recursive: true });
    const key = createHash("sha256")
      .update(JSON.stringify([session.server, session.principal, workspace.id]))
      .digest("hex");
    const db = new DatabaseSync(path.join(directory, key + ".sqlite"));
    db.exec(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS cached(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,version INTEGER NOT NULL,deleted INTEGER NOT NULL,revision TEXT NOT NULL); CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,operation_id TEXT NOT NULL,base_version INTEGER NOT NULL,body TEXT NOT NULL,deleted INTEGER NOT NULL,conflict TEXT); CREATE TABLE IF NOT EXISTS collab_cache(id TEXT PRIMARY KEY,generation TEXT NOT NULL,state BLOB NOT NULL,pending INTEGER NOT NULL DEFAULT 0,error TEXT);`,
    );
    db.exec(
      "CREATE TABLE IF NOT EXISTS asset_cache(path TEXT PRIMARY KEY,name TEXT NOT NULL,data BLOB NOT NULL,pending INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS note_roles(id TEXT PRIMARY KEY,role TEXT NOT NULL)",
    );
    const vault = new OrganizationVault(db, session, workspace);
    try {
      await vault.sync();
      return vault;
    } catch (e) {
      db.close();
      throw e;
    }
  }
  route() {
    return "/v1/workspaces/" + this.workspace.id + "/notes";
  }
  async readNote(id) {
    const note = this.db
      .prepare(
        "SELECT c.id,c.title,c.body,c.revision,c.id||'.md' AS path,r.role FROM cached c LEFT JOIN note_roles r ON r.id=c.id WHERE c.id=? AND c.deleted=0",
      )
      .get(id);
    if (!note) throw Error("노트를 찾을 수 없습니다.");
    return note;
  }
  async snapshot() {
    return {
      root: this.session.server + " / " + this.workspace.name,
      name: this.workspace.name,
      kind: "server",
      role: this.workspace.role,
      notes: Array.from(
        this.db
          .prepare(
            "SELECT c.id,c.title,c.body,c.revision,c.id||'.md' AS path,r.role FROM cached c LEFT JOIN note_roles r ON r.id=c.id WHERE c.deleted=0 ORDER BY c.title",
          )
          .iterate(),
        (n) =>
          this.metadataOnly
            ? {
                ...n,
                body: JSON.parse(JSON.stringify(n.body.slice(0,240))),
                tags: [...n.body.matchAll(/(?:^|\s)#([^\s#]+)/g)].map(
                  (m) => m[1],
                ),
                unloaded: true,
                links: [
                  ...n.body
                    .replace(/```[\s\S]*?```/g, "")
                    .matchAll(/\[\[([^\]\n]+)\]\]/g),
                ].map((m) => m[1].split("|")[0].trim()),
              }
            : n,
      ),
      pending: this.db
        .prepare(
          "SELECT (SELECT count(*) FROM outbox)+(SELECT count(*) FROM collab_cache WHERE pending=1)+(SELECT count(*) FROM asset_cache WHERE pending=1) AS count",
        )
        .get().count,
    };
  }
  writable(id) {
    if (
      id &&
      this.db.prepare("SELECT role FROM note_roles WHERE id=?").get(id)
        ?.role === "reader"
    )
      throw Error("이 문서는 열람 전용입니다.");
    if (this.workspace.role === "reader")
      throw Error("열람 전용 보관함입니다.");
  }
  async create(title, body = "# " + title + "\n\n") {
    this.writable();
    const id = randomUUID(),
      revision = randomUUID();
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("INSERT INTO cached VALUES(?,?,?,?,?,?)")
        .run(id, title, body, 0, 0, revision);
      this.db
        .prepare("INSERT INTO outbox VALUES(?,?,?,?,?,NULL)")
        .run(id, randomUUID(), 0, body, 0);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return { id, title, body, path: id + ".md", revision };
  }
  async save({ id, body, revision }) {
    this.writable(id);
    if (typeof body !== "string" || body.length > 5e6)
      throw Error("문서 크기 제한을 초과했습니다.");
    const n = this.db.prepare("SELECT * FROM cached WHERE id=?").get(id);
    if (!n || n.revision !== revision)
      throw Error("문서가 변경되었습니다. 충돌 사본을 저장해 주세요.");
    const title = body.match(/^#\s+(.+)$/m)?.[1] || n.title;
    const next = randomUUID();
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("UPDATE cached SET title=?,body=?,revision=? WHERE id=?")
        .run(title, body, next, id);
      this.db
        .prepare(
          "INSERT INTO outbox VALUES(?,?,?,?,0,NULL) ON CONFLICT(id) DO UPDATE SET body=excluded.body,operation_id=excluded.operation_id",
        )
        .run(id, randomUUID(), n.version, body);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return { id, title, body, revision: next, path: id + ".md" };
  }
  async trash({ id, revision }) {
    this.writable(id);
    const n = this.db.prepare("SELECT * FROM cached WHERE id=?").get(id);
    if (!n || n.revision !== revision) throw Error("변경된 문서입니다.");
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("UPDATE cached SET deleted=1,revision=? WHERE id=?")
        .run(randomUUID(), id);
      this.db
        .prepare(
          "INSERT INTO outbox VALUES(?,?,?,?,1,NULL) ON CONFLICT(id) DO UPDATE SET deleted=1,operation_id=excluded.operation_id",
        )
        .run(id, randomUUID(), n.version, n.body);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async permissions(id, principal, readOnly) {
    return this.session.request(
      this.route() + "/" + id + "/permissions",
      principal === undefined
        ? {}
        : { method: "PUT", body: JSON.stringify({ principal, readOnly }) },
    );
  }
  async addAttachment(source) {
    this.writable();
    const ext = path.extname(source).toLowerCase();
    if (
      ![
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".pdf",
        ".xlsx",
        ".xlsm",
        ".xls",
        ".xlsb",
        ".csv",
        ".tsv",
        ".txt",
      ].includes(ext)
    )
      throw Error("지원하지 않는 첨부파일입니다.");
    if ((await stat(source)).size > 4 * 1024 * 1024)
      throw Error("조직 첨부파일은 4 MB 이하만 지원합니다.");
    const relative = "assets/" + randomUUID() + ext;
    this.db
      .prepare("INSERT INTO asset_cache VALUES(?,?,?,1)")
      .run(relative, path.basename(source), await readFile(source));
    return {
      path: relative,
      name: path.basename(source),
      kind:
        ext === ".pdf"
          ? "pdf"
          : [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)
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
      throw Error("허용되지 않은 첨부 경로입니다.");
    let asset = this.db
      .prepare("SELECT * FROM asset_cache WHERE path=?")
      .get(relative);
    if (!asset) {
      const remote = await this.session.request(
        "/v1/workspaces/" + this.workspace.id + "/" + relative,
      );
      const bytes = Buffer.from(remote.data, "base64");
      if (bytes.length > 4 * 1024 * 1024)
        throw Error("첨부파일 크기 제한을 초과했습니다.");
      this.db
        .prepare("INSERT OR IGNORE INTO asset_cache VALUES(?,?,?,0)")
        .run(relative, remote.name, bytes);
      asset = { data: bytes };
    }
    const mime =
      {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
      }[path.extname(relative)] || "application/octet-stream";
    return { mime, data: Buffer.from(asset.data).toString("base64") };
  }
  async history(id) {
    const rows = await this.session.request(
      this.route() + "/" + id + "/history",
    );
    return rows.map((n) => ({
      title: n.title,
      body: n.body,
      path: id + ".md",
      revision: String(n.version),
      savedAt: n.saved_at,
    }));
  }
  async restoreHistory({ id, revision, historyRevision }) {
    const selected = (await this.history(id)).find(
      (n) => n.revision === historyRevision,
    );
    if (!selected) throw Error("선택한 이력을 찾을 수 없습니다.");
    return this.save({ id, revision, body: selected.body });
  }
  async search(query) {
    if (typeof query !== "string" || query.length > 300)
      throw Error("검색어가 너무 깁니다.");
    const term = "%" + query.replace(/[\\%_]/g, "\\$&") + "%";
    return this.db
      .prepare(
        "SELECT id,title,substr(body,1,240) AS body,revision,id||'.md' AS path FROM cached WHERE deleted=0 AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY title LIMIT 200",
      )
      .all(term, term)
      .map((n) => ({ ...n, unloaded: true }));
  }
  putRemote(n) {
    if (n.role)
      this.db
        .prepare("INSERT OR REPLACE INTO note_roles VALUES(?,?)")
        .run(n.id, n.role);
    const local = this.db.prepare("SELECT * FROM cached WHERE id=?").get(n.id);
    const rev =
      local && local.body === n.body && Boolean(local.deleted) === n.deleted
        ? local.revision
        : randomUUID();
    this.db
      .prepare("INSERT OR REPLACE INTO cached VALUES(?,?,?,?,?,?)")
      .run(n.id, n.title, n.body, n.version, Number(n.deleted), rev);
  }
  async sync() {
    if (this.inflight) return this.inflight;
    this.inflight = this.performSync();
    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }
  async performSync() {
    for (const item of this.db
      .prepare("SELECT path FROM asset_cache WHERE pending=1")
      .all()) {
      const asset = this.db
        .prepare("SELECT * FROM asset_cache WHERE path=?")
        .get(item.path);
      await this.session.request(
        "/v1/workspaces/" + this.workspace.id + "/" + asset.path,
        {
          method: "PUT",
          body: JSON.stringify({
            name: asset.name,
            data: Buffer.from(asset.data).toString("base64"),
          }),
        },
      );
      this.db
        .prepare("UPDATE asset_cache SET pending=0 WHERE path=?")
        .run(asset.path);
    }
    for (const pending of this.db
      .prepare("SELECT id FROM collab_cache WHERE pending=1 AND error IS NULL")
      .all()) {
      try {
        await this.collaborationSync(pending.id);
      } catch (e) {
        if (![409, 404].includes(e.status)) throw e;
      }
    }
    for (const item of this.db
      .prepare("SELECT id FROM outbox WHERE conflict IS NULL")
      .all()) {
      const op = this.db
        .prepare("SELECT * FROM outbox WHERE id=?")
        .get(item.id);
      if (!op) continue;
      try {
        const result = await this.session.request(this.route(), {
          method: "PUT",
          body: JSON.stringify({
            id: op.id,
            operationId: op.operation_id,
            baseVersion: op.base_version,
            body: op.body,
            deleted: Boolean(op.deleted),
          }),
        });
        const latest = this.db
          .prepare("SELECT * FROM outbox WHERE id=?")
          .get(op.id);
        this.db.exec("BEGIN");
        try {
          if (latest?.operation_id === op.operation_id) {
            this.putRemote(result);
            this.db.prepare("DELETE FROM outbox WHERE id=?").run(op.id);
          } else if (latest) {
            this.db
              .prepare("UPDATE cached SET version=? WHERE id=?")
              .run(result.version, op.id);
            this.db
              .prepare("UPDATE outbox SET base_version=? WHERE id=?")
              .run(result.version, op.id);
          }
          this.db.exec("COMMIT");
        } catch (e) {
          this.db.exec("ROLLBACK");
          throw e;
        }
      } catch (e) {
        if (e.status === 409)
          this.db
            .prepare("UPDATE outbox SET conflict=? WHERE id=?")
            .run(JSON.stringify(e.current || {}), op.id);
        else throw e;
      }
    }
    let after = null;
    do {
      const page = await this.session.request(
        this.route() + (after ? "?after=" + after : ""),
      );
      for (const n of page.notes)
        if (!this.db.prepare("SELECT id FROM outbox WHERE id=?").get(n.id))
          this.putRemote(n);
      after = page.next;
    } while (after);
    return this.snapshot();
  }
  async refresh() {
    return this.sync();
  }
  async conflicts() {
    return this.db
      .prepare(
        "SELECT o.id,c.title,o.body,o.conflict FROM outbox o JOIN cached c ON c.id=o.id WHERE o.conflict IS NOT NULL",
      )
      .all()
      .map((n) => ({ ...n, server: JSON.parse(n.conflict) }));
  }
  async resolveConflict(id, choice) {
    const op = this.db
      .prepare("SELECT * FROM outbox WHERE id=? AND conflict IS NOT NULL")
      .get(id);
    if (!op) throw Error("충돌 항목이 없습니다.");
    if (!["server", "copy"].includes(choice))
      throw Error("올바르지 않은 해결 방법입니다.");
    if (choice === "copy")
      await this.create(
        "충돌 사본",
        op.body.replace(/^#\s+(.+)$/m, "# $1 (충돌 사본)"),
      );
    const server = JSON.parse(op.conflict);
    this.db.exec("BEGIN");
    try {
      if (server.id) this.putRemote(server);
      else this.db.prepare("DELETE FROM cached WHERE id=?").run(id);
      this.db.prepare("DELETE FROM outbox WHERE id=?").run(id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return this.snapshot();
  }
  async collaborationStart(id) {
    if (this.workspace.role === "reader")
      throw Error("공동 편집에는 편집 권한이 필요합니다.");
    await this.sync();
    if (this.db.prepare("SELECT id FROM outbox WHERE id=?").get(id))
      throw Error("문서 충돌을 먼저 해결해 주세요.");
    const pending = this.db
      .prepare("SELECT * FROM collab_cache WHERE id=? AND pending=1")
      .get(id);
    if (pending)
      return {
        id,
        generation: pending.generation,
        state: Buffer.from(pending.state).toString("base64"),
        pending: true,
        error: pending.error,
      };
    const packet = await this.session.request(
      this.route() + "/" + id + "/collaboration?mode=blocks",
    );
    this.db
      .prepare("INSERT OR REPLACE INTO collab_cache VALUES(?,?,?,0,NULL)")
      .run(id, packet.generation, Buffer.from(packet.state, "base64"));
    return packet;
  }
  async collaborationUpdate({ id, generation, state }) {
    if (typeof state !== "string" || state.length > 6e6)
      throw Error("공동 편집 크기 제한을 초과했습니다.");
    const local = this.db
      .prepare("SELECT * FROM collab_cache WHERE id=?")
      .get(id);
    if (!local || local.generation !== generation)
      throw Error("공동 편집 세션을 다시 열어 주세요.");
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, local.state);
      Y.applyUpdate(doc, Buffer.from(state, "base64"));
      const encoded = Buffer.from(Y.encodeStateAsUpdate(doc));
      if (encoded.length > 4e6)
        throw Error("공동 편집 크기 제한을 초과했습니다.");
      this.db
        .prepare("UPDATE collab_cache SET state=?,pending=1 WHERE id=?")
        .run(encoded, id);
      return { saved: true };
    } finally {
      doc.destroy();
    }
  }
  async collaborationSync(id, presence) {
    const before = this.db
      .prepare("SELECT * FROM collab_cache WHERE id=?")
      .get(id);
    if (!before) throw Error("공동 편집을 먼저 열어 주세요.");
    let packet;
    try {
      packet = await this.session.request(
        this.route() + "/" + id + "/collaboration?mode=blocks",
        before.pending || presence
          ? {
              method: "PATCH",
              body: JSON.stringify({
                presence,
                generation: before.generation,
                state: Buffer.from(before.state).toString("base64"),
              }),
            }
          : {},
      );
    } catch (e) {
      if (e.status === 409 || e.status === 404)
        this.db
          .prepare("UPDATE collab_cache SET error=? WHERE id=?")
          .run(
            "다른 편집 방식으로 문서가 변경되었습니다. 내 내용을 사본으로 보존해 주세요.",
            id,
          );
      throw e;
    }
    const latest = this.db
      .prepare("SELECT * FROM collab_cache WHERE id=?")
      .get(id);
    if (packet.generation !== latest.generation) {
      this.db
        .prepare("UPDATE collab_cache SET error=? WHERE id=?")
        .run(
          "문서 세대가 변경되었습니다. 사본을 보존하고 다시 참여하세요.",
          id,
        );
      throw Error("문서가 외부에서 변경되었습니다.");
    }
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, latest.state);
      Y.applyUpdate(doc, Buffer.from(packet.state, "base64"));
      const encoded = Buffer.from(Y.encodeStateAsUpdate(doc));
      const more = !Buffer.from(latest.state).equals(Buffer.from(before.state));
      this.db
        .prepare(
          "UPDATE collab_cache SET state=?,pending=?,error=NULL WHERE id=?",
        )
        .run(encoded, Number(more), id);
      if (!this.db.prepare("SELECT id FROM outbox WHERE id=?").get(id)) {
        const body = collaborationBody(doc);
        this.putRemote({
          id,
          title: body.match(/^#\s+(.+)$/m)?.[1] || "노트",
          body,
          version: packet.version,
          deleted: false,
        });
      }
      return { ...packet, state: encoded.toString("base64"), pending: more };
    } finally {
      doc.destroy();
    }
  }
  async collaborationCopy(id) {
    const local = this.db
      .prepare("SELECT * FROM collab_cache WHERE id=?")
      .get(id);
    if (!local) throw Error("보관된 공동 편집 내용이 없습니다.");
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, local.state);
      const n = await this.create(
        "공동 편집 사본",
        collaborationBody(doc).replace(/^#\s+(.+)$/m, "# $1 (공동 편집 사본)"),
      );
      this.db.prepare("DELETE FROM collab_cache WHERE id=?").run(id);
      return n;
    } finally {
      doc.destroy();
    }
  }
  async close() {
    if (this.inflight) await this.inflight.catch(() => {});
    this.db.close();
  }
}
