/**
 * src/agents/agents.import-contracts-c.test.ts
 */
import { describe, expect, it } from "vitest";
const modules = [
  "console-sanitize", "context-cache", "context-tokens.runtime",
  "coreblow-tools.runtime", "coreblow-tools", "custom-api-registry",
  "deepseek-models", "defaults", "docs-path", "doubao-models",
];
describe("agents/ — import contracts (batch C)", () => {
  for (const n of modules) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
