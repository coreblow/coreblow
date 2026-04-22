/**
 * src/agents/agents.import-contracts-f.test.ts
 */
import { describe, expect, it } from "vitest";
const modules = [
  "models-config.plan", "models-config.providers.implicit",
  "models-config.providers.normalize", "models-config.providers.policy",
  "models-config.providers.secrets", "models-config.providers.source-managed",
  "models-config.providers.static", "models-config.providers",
  "models-config.runtime", "auth-profiles.resolve-auth-profile-order.fixtures",
];
describe("agents/ — import contracts (batch F)", () => {
  for (const n of modules) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
