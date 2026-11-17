# Changelog

## 0.2.0 — 2026-11-17

- Add Markdown block editing, block ordering and stable note-link selection.
- Add history and trash restoration, filesystem watching, image/PDF attachments and HTML import.
- Preserve v0.1 Markdown originals and note IDs during index upgrades; gate future index versions.
- Move local storage work to a worker, add FTS and incremental indexing, and add graph filters.
- Add PostgreSQL workspaces, versioned writes, membership roles, audit events and Redis notifications.
- Add OIDC/PKCE login, secure token persistence when available, durable offline changes and conflict copies.
- Add Yjs Markdown text collaboration with local pending state and participant presence.
- Add manual update controls and multi-platform packaging CI.
- Shorten README; move detailed usage and roadmap into separate documents.

This is a development alpha. Production SSO policies, signed upgrade installation, and real macOS/Windows validation remain release prerequisites. Back up personal vaults and unsent organization data before upgrading.

## 0.1.0 — 2026-11-17

- Initial Electron application with monochrome themes, local Markdown, SQLite search, backlinks, graph and Markdown/HTML/PDF export.
