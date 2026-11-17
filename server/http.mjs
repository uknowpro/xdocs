import { CollaborationService } from "./collaboration.mjs";
import { createServer } from "node:http";
import { fail } from "./service.mjs";
export function createApi({ service, authenticate, events, identity }) {
  const collaboration = new CollaborationService(service);
  const send = (res, status, data) => {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  async function body(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 6e6) throw fail(413, "Request too large");
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      throw fail(400, "Invalid JSON");
    }
  }
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/health")
        return send(res, 200, { ok: true });
      if (req.method === "GET" && url.pathname === "/v1/identity")
        return send(res, 200, identity);
      const actor = await authenticate(req.headers.authorization);
      if (req.method === "GET" && url.pathname === "/v1/me")
        return send(res, 200, { principal: actor.principal });
      if (req.method === "GET" && url.pathname === "/v1/workspaces")
        return send(res, 200, await service.list(actor.principal));
      const asset = url.pathname.match(
        /^\/v1\/workspaces\/([^/]+)\/assets\/([^/]+)$/,
      );
      if (asset && ["GET", "PUT"].includes(req.method))
        return send(
          res,
          200,
          await service.attachment(
            asset[1],
            actor.principal,
            asset[2],
            req.method === "PUT" ? await body(req) : undefined,
          ),
        );
      const permission = url.pathname.match(
        /^\/v1\/workspaces\/([^/]+)\/notes\/([^/]+)\/permissions$/,
      );
      if (permission && ["GET", "PUT"].includes(req.method)) {
        const input = req.method === "PUT" ? await body(req) : {};
        return send(
          res,
          200,
          await service.permissions(
            permission[1],
            actor.principal,
            permission[2],
            input.principal,
            input.readOnly,
          ),
        );
      }
      const collab = url.pathname.match(
        /^\/v1\/workspaces\/([^/]+)\/notes\/([^/]+)\/collaboration$/,
      );
      if (collab && ["GET", "PATCH"].includes(req.method))
        return send(
          res,
          200,
          await collaboration.transact(
            collab[1],
            actor.principal,
            collab[2],
            req.method === "PATCH" ? await body(req) : undefined,
            url.searchParams.get("mode") === "blocks" ? "blocks" : "text",
          ),
        );
      const route = url.pathname.match(
        /^\/v1\/workspaces\/([^/]+)\/(notes|events|members)(?:\/([^/]+)\/history)?$/,
      );
      if (!route) throw fail(404, "Not found");
      const [, workspace, resource, id] = route;
      if (resource === "notes" && id && req.method === "GET")
        return send(
          res,
          200,
          await service.history(workspace, actor.principal, id),
        );
      if (resource === "notes" && req.method === "GET")
        return send(
          res,
          200,
          await service.documents(
            workspace,
            actor.principal,
            url.searchParams.get("after"),
          ),
        );
      if (resource === "notes" && req.method === "PUT")
        return send(
          res,
          200,
          await service.mutate(workspace, actor.principal, await body(req)),
        );
      if (resource === "members" && req.method === "PUT") {
        const input = await body(req);
        await service.grant(
          workspace,
          actor.principal,
          input.principal,
          input.role,
        );
        return send(res, 200, { ok: true });
      }
      if (resource === "events" && req.method === "GET") {
        await service.role(workspace, actor.principal);
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write(": connected\n\n");
        const listener = async (event) => {
          if (event.workspace !== workspace) return;
          try {
            if (actor.expiresAt <= Date.now() / 1000) throw Error("Expired");
            await service.role(workspace, actor.principal);
            res.write(
              "data: " +
                JSON.stringify({ id: event.id, version: event.version }) +
                "\n\n",
            );
          } catch {
            res.end();
          }
        };
        events.on("change", listener);
        const timer = setInterval(async () => {
          try {
            if (actor.expiresAt <= Date.now() / 1000) throw Error("Expired");
            await service.role(workspace, actor.principal);
            res.write(": heartbeat\n\n");
          } catch {
            res.end();
          }
        }, 15000);
        res.on("close", () => {
          clearInterval(timer);
          events.off("change", listener);
        });
        return;
      }
      throw fail(405, "Method not allowed");
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const status = e.status || 500;
      send(res, status, {
        error: status === 500 ? "Internal server error" : e.message,
        ...(status === 409 ? { current: e.current } : {}),
      });
    }
  });
}
