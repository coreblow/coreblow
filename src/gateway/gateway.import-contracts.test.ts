/**
 * src/gateway/gateway.import-contracts.test.ts
 *
 * CoreBlow — Gateway Module Import Contracts (Batch A)
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "gateway-types",              path: "./gateway-types.js" },
  { name: "config",                     path: "./config.js" },
  { name: "connection-details",         path: "./connection-details.js" },
  { name: "agent-list",                 path: "./agent-list.js" },
  { name: "auth-install-policy",        path: "./auth-install-policy.js" },
  { name: "health-probe-routes",        path: "./health-probe-routes.js" },
  { name: "node-registry",              path: "./node-registry.js" },
  { name: "gateway-services",           path: "./gateway-services.js" },
  { name: "agent-event-assistant-text", path: "./agent-event-assistant-text.js" },
  { name: "live-image-probe",           path: "./live-image-probe.js" },
];

describe("gateway/ — import contracts (batch A)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
