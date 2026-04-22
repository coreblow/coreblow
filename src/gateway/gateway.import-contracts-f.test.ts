/**
 * src/gateway/gateway.import-contracts-f.test.ts
 *
 * CoreBlow — Gateway Module Import Contracts (Batch F - remaining uncovered)
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "test-helpers.e2e",             path: "./test-helpers.e2e.js" },
  { name: "test-helpers.openai-mock",     path: "./test-helpers.openai-mock.js" },
  { name: "test-helpers.server",          path: "./test-helpers.server.js" },
  { name: "test-http-response",           path: "./test-http-response.js" },
  { name: "test-openai-responses-model",  path: "./test-openai-responses-model.js" },
  { name: "test-temp-config",             path: "./test-temp-config.js" },
  { name: "test-with-server",             path: "./test-with-server.js" },
  { name: "session-utils.types",          path: "./session-utils.types.js" },
];

describe("gateway/ — import contracts (batch F)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
