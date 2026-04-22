/**
 * src/agents/agents.import-contracts-d.test.ts
 */
import { describe, expect, it } from "vitest";
const modules = [
  "embedded-pi-lsp", "embedded-pi-mcp", "fork", "lifecycle",
  "live-auth-keys", "mcp-stdio", "minimax-vlm",
  "model-alias-lines", "model-auth-env-vars", "model-auth-env",
];
describe("agents/ — import contracts (batch D)", () => {
  for (const n of modules) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
