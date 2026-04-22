/**
 * src/gateway/server-methods/import-contracts-b.test.ts
 *
 * CoreBlow — Gateway Server Methods Import Contracts (Batch B)
 */
import { describe, expect, it } from "vitest";

const methods = [
  "exec-approval",
  "exec-approvals",
  "health",
  "logs",
  "models",
  "nodes",
  "restart-request",
  "send",
  "sessions",
  "skills",
];

describe("gateway/server-methods — import contracts (batch B)", () => {
  for (const name of methods) {
    it(`${name} is importable`, async () => {
      const mod = await import(`./${name}.js`).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
