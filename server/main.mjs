import pg from "pg";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { WorkspaceService, principalFor, fail } from "./service.mjs";
import { Events } from "./events.mjs";
import { createApi } from "./http.mjs";
for (const key of [
  "DATABASE_URL",
  "OIDC_ISSUER",
  "OIDC_AUDIENCE",
  "OIDC_CLIENT_ID",
])
  if (!process.env[key]) throw new Error("Missing " + key);
const issuer = new URL(process.env.OIDC_ISSUER);
if (
  issuer.protocol !== "https:" &&
  !(
    process.env.ALLOW_LOCAL_HTTP === "1" &&
    ["localhost", "127.0.0.1"].includes(issuer.hostname)
  )
)
  throw Error("OIDC issuer must use HTTPS");
const metadata = await fetch(
  new URL(issuer.href.replace(/\/$/, "") + "/.well-known/openid-configuration"),
  { signal: AbortSignal.timeout(10000), redirect: "error" },
).then((r) => {
  if (!r.ok) throw Error("OIDC discovery failed");
  return r.json();
});
if (metadata.issuer.replace(/\/$/, "") !== issuer.href.replace(/\/$/, ""))
  throw Error("OIDC issuer mismatch");
const jwks = new URL(metadata.jwks_uri);
if (
  jwks.protocol !== "https:" &&
  !(
    process.env.ALLOW_LOCAL_HTTP === "1" &&
    ["localhost", "127.0.0.1"].includes(jwks.hostname)
  )
)
  throw Error("JWKS requires HTTPS");
const keys = createRemoteJWKSet(jwks);
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
const events = new Events();
await events.connect(process.env.REDIS_URL);
const service = new WorkspaceService(pool, events);
await service.initialize();
const authenticate = async (header) => {
  if (typeof header !== "string" || !header.startsWith("Bearer "))
    throw fail(401, "Authentication required");
  try {
    const { payload } = await jwtVerify(header.slice(7), keys, {
      issuer: metadata.issuer,
      audience: process.env.OIDC_AUDIENCE,
      algorithms: ["RS256", "ES256"],
      requiredClaims: ["sub", "exp", "iss", "aud"],
    });
    return {
      principal: principalFor(payload.iss, payload.sub),
      expiresAt: payload.exp,
    };
  } catch {
    throw fail(401, "Invalid or expired token");
  }
};
const api = createApi({
  service,
  events,
  authenticate,
  identity: {
    issuer: metadata.issuer,
    clientId: process.env.OIDC_CLIENT_ID,
    scope: process.env.OIDC_SCOPE || "openid profile",
    audience: process.env.OIDC_AUDIENCE,
  },
});
api.listen(
  Number(process.env.PORT || 4242),
  process.env.HOST || "127.0.0.1",
  () => console.log("xdocs organization API listening"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    api.close(async () => {
      await events.close();
      await pool.end();
      process.exit(0);
    }),
  );
