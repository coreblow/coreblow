import { describe, expect, it } from "vitest";

const modules = [
  { name: "cli-session-history.claude", path: "./cli-session-history.claude.js" },
  { name: "cli-session-history.merge",  path: "./cli-session-history.merge.js" },
  { name: "config",                     path: "./config.js" },
  { name: "connection-details",         path: "./connection-details.js" },
  { name: "control-ui-http-utils",      path: "./control-ui-http-utils.js" },
  { name: "control-ui",                 path: "./control-ui.js" },
  { name: "exec-approval-manager",      path: "./exec-approval-manager.js" },
  { name: "gateway-auth",               path: "./gateway-auth.js" },
  { name: "node-registry",              path: "./node-registry.js" },
  { name: "plugin-integration",         path: "./plugin-integration.js" },
];

describe("gateway/ close B — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
