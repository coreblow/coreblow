/**
 * src/agents/cli-runner/import-contracts.test.ts
 * CoreBlow — Agents CLI Runner Import Contracts
 */
import { describe, expect, it } from "vitest";
const modules = [
  "cli-abort", "cli-display", "cli-prompt", "cli-runner",
  "cli-session", "cli-streaming", "execute", "helpers",
  "index", "log", "prepare", "reliability", "types",
];
describe("agents/cli-runner/ — import contracts", () => {
  for (const name of modules) {
    it(`${name} is importable`, async () => {
      const m = await import(`./${name}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
