import * as Y from "yjs";
import { chromium } from "@playwright/test";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {
  OrganizationSession,
  OrganizationVault,
} from "../desktop/organization.mjs";
const directory = await mkdtemp(path.join(os.tmpdir(), "xdocs-oidc-"));
const browser = await chromium.launch();
const page = await browser.newPage();
let vault, second;
try {
  const session = new OrganizationSession({
    directory,
    safeStorage: { isEncryptionAvailable: () => false },
    openExternal: async (url) => {
      await page.goto(url);
    },
  });
  const pending = session.login("http://127.0.0.1:4242");
  await page.locator("#username").fill("developer");
  await page.locator("#password").fill("local-development-only");
  await page.locator("#kc-login").click();
  const workspaces = await pending;
  assert.ok(workspaces.length);
  assert.equal(
    session.principal,
    JSON.stringify([
      "http://127.0.0.1:58080/realms/xdocs",
      "10000000-0000-4000-8000-000000000001",
    ]),
  );
  assert.equal(
    (await readdir(directory)).filter((n) => n.endsWith(".tokens")).length,
    0,
  );
  vault = await OrganizationVault.open(
    path.join(directory, "cache"),
    session,
    workspaces[0],
  );
  let n = await vault.create(
    "SSO 통합 검증",
    "# SSO 통합 검증\n\nPKCE + PostgreSQL",
  );
  await vault.sync();
  assert.equal((await vault.snapshot()).pending, 0);
  second = await OrganizationVault.open(
    path.join(directory, "second-device"),
    session,
    workspaces[0],
  );
  const a = await vault.collaborationStart(n.id),
    b = await second.collaborationStart(n.id);
  const left = new Y.Doc(),
    right = new Y.Doc();
  Y.applyUpdate(left, Buffer.from(a.state, "base64"));
  Y.applyUpdate(right, Buffer.from(b.state, "base64"));
  left.getText("markdown").insert(left.getText("markdown").length, " 기기A");
  right.getText("markdown").insert(right.getText("markdown").length, " 기기B");
  await vault.collaborationUpdate({
    ...a,
    state: Buffer.from(Y.encodeStateAsUpdate(left)).toString("base64"),
  });
  await second.collaborationUpdate({
    ...b,
    state: Buffer.from(Y.encodeStateAsUpdate(right)).toString("base64"),
  });
  await Promise.all([
    vault.collaborationSync(n.id),
    second.collaborationSync(n.id),
  ]);
  const merged = await vault.collaborationSync(n.id);
  const combined = new Y.Doc();
  Y.applyUpdate(combined, Buffer.from(merged.state, "base64"));
  assert.match(combined.getText("markdown").toString(), /기기A/);
  assert.match(combined.getText("markdown").toString(), /기기B/);
  left.destroy();
  right.destroy();
  combined.destroy();
  await second.close();
  second = null;
  n = (await vault.snapshot()).notes.find((v) => v.id === n.id);
  await vault.trash(n);
  await vault.sync();
  const token = session.tokens.access_token;
  session.tokens.access_token = "invalid";
  await assert.rejects(
    session.request("/v1/workspaces"),
    (e) => e.status === 401,
  );
  session.tokens.access_token = token;
  await session.logout();
  await assert.rejects(session.request("/v1/workspaces"), /로그인/);
  console.log(
    "PASS real Keycloak OIDC: PKCE login, token audience verification, workspace membership, Postgres save/delete, two-device CRDT merge, no plaintext token persistence, logout",
  );
} finally {
  await second?.close();
  await vault?.close();
  await browser.close();
  await rm(directory, { recursive: true, force: true });
}
