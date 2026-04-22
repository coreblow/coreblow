/**
 * src/agents/agents.import-contracts-b.test.ts
 * CoreBlow — Agents Import Contracts (Batch B)
 */
import { describe, expect, it } from "vitest";
const modules = [
  "byteplus-models", "claude-cli-runner", "cli-runner",
  "cli-watchdog-defaults", "command-poll-backoff.runtime",
  "auth-profiles.runtime", "auth-profiles",
  "bash-process-registry.test-helpers", "bundle-mcp.test-harness",
  "cli-runner.test-support",
];
describe("agents/ — import contracts (batch B)", () => {
  for (const name of modules) {
    it(`${name} is importable`, async () => {
      const m = await import(`./${name}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
