CREATE TABLE IF NOT EXISTS schema_version(version integer PRIMARY KEY);
INSERT INTO schema_version VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS workspaces(id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS members(workspace_id uuid REFERENCES workspaces(id), principal text NOT NULL, role text NOT NULL CHECK(role IN ('owner','editor','reader')), PRIMARY KEY(workspace_id,principal));
CREATE TABLE IF NOT EXISTS documents(workspace_id uuid REFERENCES workspaces(id), id uuid NOT NULL, title text NOT NULL, body text NOT NULL, version integer NOT NULL, deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,id));
CREATE TABLE IF NOT EXISTS document_versions(workspace_id uuid NOT NULL, id uuid NOT NULL, version integer NOT NULL, title text NOT NULL, body text NOT NULL, deleted boolean NOT NULL, actor text NOT NULL, saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,id,version));
CREATE TABLE IF NOT EXISTS mutations(workspace_id uuid NOT NULL, principal text NOT NULL, operation_id uuid NOT NULL, result jsonb NOT NULL, PRIMARY KEY(workspace_id,principal,operation_id));
CREATE TABLE IF NOT EXISTS audit_events(id bigserial PRIMARY KEY, workspace_id uuid NOT NULL, actor text NOT NULL, action text NOT NULL, document_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS documents_workspace_idx ON documents(workspace_id, id);

CREATE TABLE IF NOT EXISTS collaboration_states(workspace_id uuid NOT NULL,id uuid NOT NULL,generation uuid NOT NULL,state bytea NOT NULL,PRIMARY KEY(workspace_id,id));

CREATE TABLE IF NOT EXISTS attachments(workspace_id uuid REFERENCES workspaces(id),path text NOT NULL,name text NOT NULL,data bytea NOT NULL,PRIMARY KEY(workspace_id,path));
CREATE TABLE IF NOT EXISTS document_readers(workspace_id uuid NOT NULL,id uuid NOT NULL,principal text NOT NULL,PRIMARY KEY(workspace_id,id,principal),FOREIGN KEY(workspace_id,principal) REFERENCES members(workspace_id,principal));
