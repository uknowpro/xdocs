# xdocs architecture and next milestones

## Current implementation

The personal vault owns Markdown files. SQLite holds derived note/search/link data and can be rebuilt. The renderer only receives a narrow preload API. No arbitrary path API is exposed. Writes use a temporary file, fsync, revision check and rename. Conflict errors keep the draft visible and offer a separate copy.

The renderer's browser-only adapter is explicitly marked as a preview and stores demo notes in localStorage. Production Electron always uses the filesystem adapter. There is no fallback from an Electron save error to browser storage.

## Next milestones

1. Rich block editing with a documented, loss-tested Markdown subset. Attachment handling and ID-link picker; external file watcher and in-app trash restore.
2. Search scaling: incremental indexes, FTS, worker/utility process for large vaults; graph filtering and virtualization.
3. Server workspace: PostgreSQL authoritative document versions; object storage for attachments. Local offline outbox must be durable and separate from derived indexes.
4. OIDC authorization-code + PKCE through the system browser; OS credential storage, workspace RBAC, server-side permission checks across search and graph. SAML through identity provider integration if required.
5. Versioned synchronization and conflict resolution, followed by collaboration. Redis is optional for presence and event fan-out, never document persistence.

Local and server workspaces must have an explicit authority boundary. Personal content is never uploaded by simply connecting an organization. UI must identify sharing scope before moving documents between workspaces.

## Validation boundary

Store tests cover file persistence, index reconstruction, external write conflicts, trash preservation, path/symlink rejection and duplicate IDs. UI tests cover theme persistence, editing, search, graph navigation, content sanitization and layout width. Real packaged Windows/macOS tests remain necessary before claiming platform support.
