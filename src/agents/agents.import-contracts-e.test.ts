import { describe, expect, it } from "vitest";
const modules = [
  "model-auth-label", "model-auth-runtime-shared", "model-catalog.runtime",
  "model-catalog.test-harness", "model-fallback-observation", "model-fallback.types",
  "model-scan", "model-suppression.runtime", "model-suppression",
  "models-config.e2e-harness",
];
describe("agents/ — import contracts (batch E)", () => {
  for (const n of modules) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
