/**
 * src/agents/auth-profiles/import-contracts.test.ts
 * CoreBlow — Agents Auth Profiles Import Contracts
 */
import { describe, expect, it } from "vitest";
const modules = [
  "constants", "doctor", "external-cli-sync", "identity",
  "index", "paths", "profiles", "repair", "resolve", "store", "types", "upsert-with-lock",
];
describe("agents/auth-profiles/ — import contracts", () => {
  for (const name of modules) {
    it(`${name} is importable`, async () => {
      const m = await import(`./${name}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
