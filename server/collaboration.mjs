import * as Y from "yjs";
import { randomUUID } from "node:crypto";
import { fail, validUUID } from "./service.mjs";
export class CollaborationService {
  constructor(service) {
    this.service = service;
  }
  async initialize() {
    await this.service.pool.query(
      "CREATE TABLE IF NOT EXISTS collaboration_states(workspace_id uuid NOT NULL,id uuid NOT NULL,generation uuid NOT NULL,state bytea NOT NULL,PRIMARY KEY(workspace_id,id))",
    );
  }
  async transact(workspace, principal, id, update) {
    if (!validUUID(workspace) || !validUUID(id))
      throw fail(400, "Invalid document");
    if (
      update &&
      (!validUUID(update.generation) ||
        typeof update.state !== "string" ||
        update.state.length > 6e6)
    )
      throw fail(400, "Invalid collaboration update");
    const client = await this.service.pool.connect();
    let result,
      changed = false;
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [
        workspace,
      ]);
      const role = await this.service.role(workspace, principal, client);
      if (update && role === "reader") throw fail(403, "Read-only workspace");
      const current = (
        await client.query(
          "SELECT * FROM documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE",
          [workspace, id],
        )
      ).rows[0];
      if (!current || current.deleted) throw fail(404, "Document unavailable");
      let saved = (
        await client.query(
          "SELECT * FROM collaboration_states WHERE workspace_id=$1 AND id=$2",
          [workspace, id],
        )
      ).rows[0];
      const doc = new Y.Doc(),
        text = doc.getText("markdown");
      try {
        if (saved) Y.applyUpdate(doc, saved.state);
        else {
          text.insert(0, current.body);
          saved = { generation: randomUUID() };
        }
        if (update) {
          if (update.generation !== saved.generation)
            throw fail(409, "Document changed outside collaboration");
          try {
            Y.applyUpdate(doc, Buffer.from(update.state, "base64"));
          } catch {
            throw fail(400, "Invalid CRDT state");
          }
        }
        const body = text.toString(),
          state = Buffer.from(Y.encodeStateAsUpdate(doc));
        if (state.length > 4e6 || Buffer.byteLength(body) > 5e6)
          throw fail(413, "Collaboration document too large");
        if (body !== current.body) {
          changed = true;
          const title =
            body.match(/^#\s+(.+)$/m)?.[1]?.slice(0, 200) || current.title;
          await client.query(
            "UPDATE documents SET body=$3,title=$4,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",
            [workspace, id, body, title],
          );
          await client.query(
            "INSERT INTO document_versions(workspace_id,id,version,title,body,deleted,actor) VALUES($1,$2,$3,$4,$5,false,$6)",
            [workspace, id, current.version + 1, title, body, principal],
          );
          await client.query(
            "INSERT INTO audit_events(workspace_id,actor,action,document_id) VALUES($1,$2,$3,$4)",
            [workspace, principal, "collaborate", id],
          );
        }
        await client.query(
          "INSERT INTO collaboration_states VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,id) DO UPDATE SET state=excluded.state,generation=excluded.generation",
          [workspace, id, saved.generation, state],
        );
        result = {
          id,
          generation: saved.generation,
          state: state.toString("base64"),
          version: current.version + (changed ? 1 : 0),
          body,
        };
        await client.query("COMMIT");
      } finally {
        doc.destroy();
      }
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    if (changed)
      await this.service.events
        ?.publish({ workspace, id, version: result.version })
        .catch(() => {});
    result.participants =
      (await this.service.events
        ?.touch(workspace, id, principal)
        .catch(() => [])) || [];
    return result;
  }
}
