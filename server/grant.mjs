import pg from "pg";
import { randomUUID } from "node:crypto";
import { WorkspaceService, principalFor } from "./service.mjs";
const [subject, name = "개발팀", role = "owner", existing] =
  process.argv.slice(2);
if (
  !subject ||
  !["owner", "editor", "reader"].includes(role) ||
  !process.env.OIDC_ISSUER
)
  throw Error(
    "Usage: npm run server:grant -- SUBJECT WORKSPACE_NAME ROLE [WORKSPACE_UUID]",
  );
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const service = new WorkspaceService(pool);
await service.initialize();
const id = existing || randomUUID();
try {
  await pool.query(
    "INSERT INTO workspaces VALUES($1,$2) ON CONFLICT(id) DO NOTHING",
    [id, name],
  );
  await pool.query(
    "INSERT INTO members VALUES($1,$2,$3) ON CONFLICT(workspace_id,principal) DO UPDATE SET role=excluded.role",
    [id, principalFor(process.env.OIDC_ISSUER, subject), role],
  );
  console.log("Workspace membership configured:", id);
} finally {
  await pool.end();
}
