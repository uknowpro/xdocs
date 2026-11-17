import { collaborationBody } from "../shared/collab-blocks.mjs";
import * as Y from "yjs";
import { chromium } from "@playwright/test";
import { mkdtemp, rm, readdir, writeFile } from "node:fs/promises";
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
  left.getArray("blocks").get(0).get("text").insert(0, "기기A ");
  right.getArray("blocks").get(0).get("text").insert(0, "기기B ");
  await vault.collaborationUpdate({
    ...a,
    state: Buffer.from(Y.encodeStateAsUpdate(left)).toString("base64"),
  });
  await second.collaborationUpdate({
    ...b,
    state: Buffer.from(Y.encodeStateAsUpdate(right)).toString("base64"),
  });
  const originalRequest = session.request.bind(session);
  session.request = async () => {
    throw Error("simulated network outage");
  };
  await assert.rejects(vault.collaborationSync(n.id), /outage/);
  await vault.close();
  vault = null;
  session.request = originalRequest;
  vault = await OrganizationVault.open(
    path.join(directory, "cache"),
    session,
    workspaces[0],
  );
  await Promise.all([
    vault.collaborationSync(n.id),
    second.collaborationSync(n.id),
  ]);
  const merged = await vault.collaborationSync(n.id);
  const combined = new Y.Doc();
  Y.applyUpdate(combined, Buffer.from(merged.state, "base64"));
  assert.match(collaborationBody(combined), /기기A/);
  assert.match(collaborationBody(combined), /기기B/);
  left.destroy();
  right.destroy();
  combined.destroy();
  const assetFile = path.join(directory, "시트.tsv");
  await writeFile(assetFile, "이름\t값\n한글\t12");
  const asset = await vault.addAttachment(assetFile);
  await vault.sync();
  assert.equal(
    Buffer.from(
      (await second.readAttachment(asset.path)).data,
      "base64",
    ).toString(),
    "이름\t값\n한글\t12",
  );
  const history = await vault.history(n.id);
  assert.ok(history.length >= 2);
  const latest = await vault.readNote(n.id);
  await vault.restoreHistory({
    id: n.id,
    revision: latest.revision,
    historyRevision: history.at(-1).revision,
  });
  await vault.sync();
  assert.match((await vault.readNote(n.id)).body, /PKCE/);
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
