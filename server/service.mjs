import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
export const principalFor = (issuer, subject) =>
  JSON.stringify([issuer, subject]);
export const fail = (status, message) =>
  Object.assign(new Error(message), { status });
export const validUUID = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
    value,
  );
export class WorkspaceService {
  constructor(pool, events) {
    this.pool = pool;
    this.events = events;
  }
  async initialize() {
    await this.pool.query(
      await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    );
    const { rows } = await this.pool.query(
      "SELECT max(version) AS version FROM schema_version",
    );
    if (rows[0].version !== 1)
      throw new Error("Unsupported server schema version");
  }
  async role(workspace, principal, client = this.pool) {
    if (!validUUID(workspace)) throw fail(400, "Invalid workspace ID");
    const { rows } = await client.query(
      "SELECT role FROM members WHERE workspace_id=$1 AND principal=$2",
      [workspace, principal],
    );
    if (!rows.length) throw fail(403, "Workspace access denied");
    return rows[0].role;
  }
  async list(principal) {
    return (
      await this.pool.query(
        "SELECT w.*,m.role FROM workspaces w JOIN members m ON m.workspace_id=w.id WHERE m.principal=$1 ORDER BY w.name",
        [principal],
      )
    ).rows;
  }
  async documents(workspace, principal, after) {
    await this.role(workspace, principal);
    if (after && !validUUID(after)) throw fail(400, "Invalid cursor");
    const { rows } = await this.pool.query(
      "SELECT * FROM documents WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT 201",
      [workspace, after || null],
    );
    return {
      notes: rows.slice(0, 200),
      next: rows.length > 200 ? rows[199].id : null,
    };
  }
  async history(workspace, principal, id) {
    await this.role(workspace, principal);
    if (!validUUID(id)) throw fail(400, "Invalid document ID");
    return (
      await this.pool.query(
        "SELECT title,body,version,deleted,saved_at FROM document_versions WHERE workspace_id=$1 AND id=$2 ORDER BY version DESC LIMIT 100",
        [workspace, id],
      )
    ).rows;
  }
  async mutate(workspace, principal, input) {
    if (
      !input ||
      !validUUID(input.id) ||
      !validUUID(input.operationId) ||
      !Number.isSafeInteger(input.baseVersion) ||
      input.baseVersion < 0 ||
      typeof input.body !== "string" ||
      Buffer.byteLength(input.body) > 5e6 ||
      typeof input.deleted !== "boolean"
    )
      throw fail(400, "Invalid document mutation");
    const client = await this.pool.connect();
    let result;
    try {
      await client.query("BEGIN");
      // The workspace lock serializes writes and membership changes made through this service.
      await client.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [
        workspace,
      ]);
      const role = await this.role(workspace, principal, client);
      if (role === "reader") throw fail(403, "Read-only workspace");
      const prior = await client.query(
        "SELECT result FROM mutations WHERE workspace_id=$1 AND principal=$2 AND operation_id=$3",
        [workspace, principal, input.operationId],
      );
      if (prior.rows.length) {
        await client.query("COMMIT");
        return prior.rows[0].result;
      }
      const current = (
        await client.query(
          "SELECT * FROM documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
          [workspace, input.id],
        )
      ).rows[0];
      if ((current?.version || 0) !== input.baseVersion)
        throw Object.assign(fail(409, "Document changed on server"), {
          current: current || null,
        });
      const title =
        input.body.match(/^#\s+(.+)$/m)?.[1]?.slice(0, 200) ||
        current?.title ||
        "새 노트";
      result = (
        await client.query(
          `INSERT INTO documents(workspace_id,id,title,body,version,deleted) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,id) DO UPDATE SET title=excluded.title,body=excluded.body,version=excluded.version,deleted=excluded.deleted,updated_at=now() RETURNING *`,
          [
            workspace,
            input.id,
            title,
            input.body,
            input.baseVersion + 1,
            input.deleted,
          ],
        )
      ).rows[0];
      await client.query(
        "INSERT INTO document_versions(workspace_id,id,version,title,body,deleted,actor) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          workspace,
          input.id,
          result.version,
          title,
          input.body,
          input.deleted,
          principal,
        ],
      );
      await client.query(
        "DELETE FROM collaboration_states WHERE workspace_id=$1 AND id=$2",
        [workspace, input.id],
      );
      await client.query("INSERT INTO mutations VALUES($1,$2,$3,$4)", [
        workspace,
        principal,
        input.operationId,
        JSON.stringify(result),
      ]);
      await client.query(
        "INSERT INTO audit_events(workspace_id,actor,action,document_id) VALUES($1,$2,$3,$4)",
        [workspace, principal, input.deleted ? "delete" : "save", input.id],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    // Persistence succeeds even if an optional Redis notification fails.
    await this.events
      ?.publish({ workspace, id: input.id, version: result.version })
      .catch(() => {});
    return result;
  }
  async grant(workspace, principal, target, role) {
    if (
      !["owner", "editor", "reader"].includes(role) ||
      typeof target !== "string" ||
      target.length > 2048
    )
      throw fail(400, "Invalid membership");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [
        workspace,
      ]);
      if ((await this.role(workspace, principal, client)) !== "owner")
        throw fail(403, "Owner access required");
      await client.query(
        "INSERT INTO members VALUES($1,$2,$3) ON CONFLICT(workspace_id,principal) DO UPDATE SET role=excluded.role",
        [workspace, target, role],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
