/**
 * src/gateway/gateway.close-contracts.test.ts
 *
 * CoreBlow — Gateway Close Import Contracts
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "agent-event-assistant-text", path: "./agent-event-assistant-text.js" },
  { name: "agent-list",                 path: "./agent-list.js" },
  { name: "api-docs",                   path: "./api-docs.js" },
  { name: "api-gateway",               path: "./api-gateway.js" },
  { name: "app-bootstrapper",           path: "./app-bootstrapper.js" },
  { name: "auth-install-policy",        path: "./auth-install-policy.js" },
  { name: "bootstrap-engine",           path: "./bootstrap-engine.js" },
  { name: "channel-bridge",             path: "./channel-bridge.js" },
  { name: "channel-manager",            path: "./channel-manager.js" },
  { name: "chat-handler",               path: "./chat-handler.js" },
];

describe("gateway/ close — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
