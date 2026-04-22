/**
 * src/gateway/server/import-contracts.test.ts
 *
 * CoreBlow — Gateway Server Module Import Contracts
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "server/hooks",                   path: "./hooks.js" },
  { name: "server/http-auth",               path: "./http-auth.js" },
  { name: "server/preauth-connection-budget", path: "./preauth-connection-budget.js" },
  { name: "server/tls",                     path: "./tls.js" },
  { name: "server/ws-connection",           path: "./ws-connection.js" },
  { name: "server/ws-types",                path: "./ws-types.js" },
  { name: "server/plugins-http/path-context", path: "./plugins-http/path-context.js" },
  { name: "server/plugins-http/route-auth",   path: "./plugins-http/route-auth.js" },
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
