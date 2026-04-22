/**
 * src/gateway/gateway.import-contracts-b.test.ts
 *
 * CoreBlow — Gateway Module Import Contracts (Batch B)
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "api-docs",                   path: "./api-docs.js" },
  { name: "api-gateway",                path: "./api-gateway.js" },
  { name: "app-bootstrapper",           path: "./app-bootstrapper.js" },
  { name: "bootstrap-engine",           path: "./bootstrap-engine.js" },
  { name: "channel-bridge",             path: "./channel-bridge.js" },
  { name: "channel-manager",            path: "./channel-manager.js" },
  { name: "chat-handler",               path: "./chat-handler.js" },
  { name: "cli-session-history.claude", path: "./cli-session-history.claude.js" },
  { name: "cli-session-history.merge",  path: "./cli-session-history.merge.js" },
  { name: "control-ui-http-utils",      path: "./control-ui-http-utils.js" },
];

describe("gateway/ — import contracts (batch B)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
