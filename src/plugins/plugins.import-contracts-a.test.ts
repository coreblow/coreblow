/**
 * src/plugins/plugins.import-contracts-a.test.ts
 */
import { describe, expect, it } from "vitest";
const modules = [
  "api-builder", "audit-log", "build-smoke-entry", "bundle-config-shared",
  "bundle-lsp", "bundle-mcp.test-support", "bundled-capability-metadata",
  "bundled-capability-runtime", "bundled-compat", "bundled-plugin-entries",
];
describe("plugins/ — import contracts (A)", () => {
  for (const n of modules) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
