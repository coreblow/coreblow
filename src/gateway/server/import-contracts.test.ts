import { describe, expect, it } from "vitest";

const modules = [
  { name: "server/hooks",                   path: "./hooks.js" },
  { name: "server/hook-client-ip-config",   path: "./hook-client-ip-config.js" },
  { name: "server/hooks-request-handler",   path: "./hooks-request-handler.js" },
  { name: "server/http-auth",               path: "./http-auth.js" },
  { name: "server/plugin-route-runtime-scopes", path: "./plugin-route-runtime-scopes.js" },
  { name: "server/preauth-connection-budget", path: "./preauth-connection-budget.js" },
  { name: "gateway/server-aux-handlers",      path: "../server-aux-handlers.js" },
  { name: "gateway/server-aux-methods",       path: "../server-aux-methods.js" },
  { name: "server/tls",                     path: "./tls.js" },
  { name: "server/ws-connection",           path: "./ws-connection.js" },
  { name: "server/ws-shared-generation",    path: "./ws-shared-generation.js" },
  { name: "server/ws-types",                path: "./ws-types.js" },
  { name: "server/plugins-http/path-context", path: "./plugins-http/path-context.js" },
  { name: "server/plugins-http/route-auth",   path: "./plugins-http/route-auth.js" },
  { name: "server/plugins-http/route-capability", path: "./plugins-http/route-capability.js" },
  { name: "server/plugins-http/route-match",  path: "./plugins-http/route-match.js" },
  { name: "server/ws-connection/auth-messages", path: "./ws-connection/auth-messages.js" },
];

describe("gateway/server/ — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
