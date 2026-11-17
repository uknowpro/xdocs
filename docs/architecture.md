# xdocs architecture

## Personal workspace

Markdown files are authoritative. The SQLite index stores derived notes, links and a trigram FTS index. The index schema has a version gate: v0.1 indexes are upgraded without rewriting Markdown, and newer unknown versions are rejected. Only changed notes are indexed on refresh.

Filesystem and SQLite work run in a Node worker behind the sandboxed Electron preload API. A filesystem watcher refreshes the index and notifies the renderer. Dirty editor drafts are not replaced by external changes. File saves verify revisions, preserve previous bodies under `.xdocs/history`, write and fsync a temporary file, and rename it into place. There is no cross-process filesystem lock, so a narrow external-write race remains.

Attachments are copied into `assets/`. Reads allow only generated asset paths, reject symlinks and cap file size. The renderer creates local blob previews; arbitrary local paths are not exposed.

## Organization workspace

PostgreSQL owns documents, versions, roles, audit events and Yjs collaboration states. All document operations check membership. Workspace-level owner/editor/reader roles apply to every document in that workspace. Mutations use workspace row locks, expected document versions and idempotency keys. Deletion is a versioned tombstone.

The desktop stores organization data separately from personal vaults. Cache filenames incorporate server, principal and workspace. `outbox` and `collab_cache` are durable unsent user data, **not disposable indexes**. Successful acknowledgements remove only the matching queued operation; newer edits remain queued. Conflicts keep both the local draft and the server state until the user chooses a copy or the server version.

OIDC uses authorization code + PKCE, state and nonce, a loopback callback, and the system browser. The API checks signature, issuer, audience and expiry. Refresh tokens are encrypted with Electron safeStorage when a secure backend exists; otherwise they remain in memory. Logout removes tokens but preserves unsent document data. A new server cannot replace an active organization session without logout.

## Collaboration

A dedicated Markdown editor binds to Y.Text. Local updates are persisted through IPC before being considered saved. Approximately once per second, clients merge Yjs state with the server. PostgreSQL stores both CRDT state and the resulting versioned Markdown. Redis optionally distributes change events and short-lived participant presence; it never owns documents.

Normal document writes invalidate the collaboration generation. Stale CRDT updates are rejected rather than replacing newer content. The client preserves its local state and offers a separate copy. This is text collaboration, not block-level ProseMirror collaboration or cursor sharing.

## Updates and packaging

Manual update check/download/restart uses electron-updater and the configured GitHub release feed. Automatic downloads and installation on ordinary quit are disabled. Restart requests flush local edits first. CI builds unsigned OS-specific artifacts; production signing, notarization and real cross-version installation require a release environment.

## Verification

Tests cover v0.1 vault compatibility, index reconstruction, history/trash, attachment paths, durable outbox recovery, CRDT concurrency/replay/generation checks, access control and workspace isolation. Browser tests exercise themes, Markdown/blocks, search and graph. Electron tests exercise real files, PDF export, external watching, recovery, attachments and the local Keycloak/PostgreSQL login flow.

See [the implementation roadmap](roadmap.md) for tracked follow-up work and [the local server guide](server.md) for reproducible integration setup.
