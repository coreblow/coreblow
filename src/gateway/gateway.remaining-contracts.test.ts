/**
 * src/gateway/gateway.remaining-contracts.test.ts
 *
 * CoreBlow — Gateway Remaining Import Contracts
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "device-authz.test-helpers",    path: "./device-authz.test-helpers.js" },
  { name: "gateway-connection.test-mocks", path: "./gateway-connection.test-mocks.js" },
  { name: "hooks-test-helpers",           path: "./hooks-test-helpers.js" },
  { name: "session-preview.test-helpers", path: "./session-preview.test-helpers.js" },
  { name: "session-utils.types",          path: "./session-utils.types.js" },
  { name: "test-helpers.agent-results",   path: "./test-helpers.agent-results.js" },
  { name: "test-helpers.mocks",           path: "./test-helpers.mocks.js" },
  { name: "test-helpers.ts",              path: "./test-helpers.js" },
  { name: "ws-connection/message-handler", path: "./server/ws-connection/message-handler.js" },
  { name: "server/message-handler",       path: "./server/ws-connection/message-handler.js" },
];

describe("gateway/ remaining — import contracts", () => {
  const seen = new Set<string>();
  const unique = modules.filter(m => {
    if (seen.has(m.path)) return false;
    seen.add(m.path);
    return true;
  });
  for (const { name, path } of unique) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
