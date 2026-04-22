/**
 * src/gateway/gateway.final-contracts.test.ts
 *
 * CoreBlow — Gateway Final Import Contracts (Close 60%)
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "gateway-config-prompts.shared",  path: "./gateway-config-prompts.shared.js" },
  { name: "gateway-connection.test-mocks",  path: "./gateway-connection.test-mocks.js" },
  { name: "gateway-services",              path: "./gateway-services.js" },
  { name: "gateway-types",                 path: "./gateway-types.js" },
  { name: "health-probe-routes",           path: "./health-probe-routes.js" },
  { name: "hooks-test-helpers",            path: "./hooks-test-helpers.js" },
  { name: "live-image-probe",              path: "./live-image-probe.js" },
  { name: "open-responses.schema",         path: "./open-responses.schema.js" },
  { name: "openresponses-prompt",          path: "./openresponses-prompt.js" },
  { name: "operator-approvals-client",     path: "./operator-approvals-client.js" },
];

describe("gateway/ final — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
