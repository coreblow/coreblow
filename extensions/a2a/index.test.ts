import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import plugin from "./index.js";

type RegisteredRoute = {
  path: string;
  auth: "gateway" | "plugin";
  match?: "exact" | "prefix";
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean | void> | boolean | void;
};

describe("extensions/a2a plugin route registration", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (srv) =>
          new Promise<void>((resolve) => {
            srv.close(() => resolve());
          }),
      ),
    );
  });

  it("mounts /.well-known/agent.json and /a2a JSON-RPC 2.0 routes on Gateway HTTP router", async () => {
    const routes: RegisteredRoute[] = [];
    const mockApi = {
      pluginConfig: {
        enabled: true,
        agentName: "CoreBlow Test Agent",
        agentVersion: "2.7.0",
      },
      registerHttpRoute(route: RegisteredRoute) {
        routes.push(route);
      },
      registerService() {},
    };

    plugin.register(mockApi as never);

    expect(routes.map((r) => r.path)).toEqual(["/.well-known/agent.json", "/a2a"]);
    expect(routes[0]?.auth).toBe("plugin");
    expect(routes[1]?.auth).toBe("gateway");

    const server = http.createServer(async (req, res) => {
      const urlPath = (req.url ?? "/").split("?")[0];
      const route = routes.find((r) => r.path === urlPath);
      if (!route) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }
      await route.handler(req, res);
    });
    servers.push(server);

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const cardRes = await fetch(`${baseUrl}/.well-known/agent.json`);
    expect(cardRes.status).toBe(200);
    const card = (await cardRes.json()) as { name: string; version: string };
    expect(card.name).toBe("CoreBlow Test Agent");
    expect(card.version).toBe("2.7.0");

    const sendRes = await fetch(`${baseUrl}/a2a`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tasks/send",
        params: {
          id: "int-task-1",
          message: { role: "user", parts: [{ type: "text", text: "hello" }] },
        },
      }),
    });
    expect(sendRes.status).toBe(200);
    const sendJson = (await sendRes.json()) as { result: { id: string; status: { state: string } } };
    expect(sendJson.result.id).toBe("int-task-1");
    expect(sendJson.result.status.state).toBe("completed");

    const getRes = await fetch(`${baseUrl}/a2a`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tasks/get",
        params: { id: "int-task-1" },
      }),
    });
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as { result: { id: string } };
    expect(getJson.result.id).toBe("int-task-1");

    const cancelRes = await fetch(`${baseUrl}/a2a`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tasks/cancel",
        params: { id: "int-task-1" },
      }),
    });
    expect(cancelRes.status).toBe(409);
  });
});
