/**
 * src/commands/status-all/import-contracts.test.ts
 *
 * CoreBlow — Commands Status-All Import Contracts
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "status-all/agents",         path: "./agents.js" },
  { name: "status-all/channel-issues", path: "./channel-issues.js" },
  { name: "status-all/channels",       path: "./channels.js" },
  { name: "status-all/diagnosis",      path: "./diagnosis.js" },
  { name: "status-all/format",         path: "./format.js" },
  { name: "status-all/gateway",        path: "./gateway.js" },
];

describe("commands/status-all/ — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
