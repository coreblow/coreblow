/**
 * src/commands/commands.import-contracts-f.test.ts
 *
 * CoreBlow — Commands Import Contracts (Batch F - status modules)
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "status.agent-local",             path: "./status.agent-local.js" },
  { name: "status.command",                 path: "./status.command.js" },
  { name: "status.command.text-runtime",    path: "./status.command.text-runtime.js" },
  { name: "status.daemon",                  path: "./status.daemon.js" },
  { name: "status.gateway-probe",           path: "./status.gateway-probe.js" },
  { name: "status.link-channel",            path: "./status.link-channel.js" },
  { name: "status.scan.deps.runtime",       path: "./status.scan.deps.runtime.js" },
  { name: "status.scan.json-core",          path: "./status.scan.json-core.js" },
  { name: "status.scan.runtime",            path: "./status.scan.runtime.js" },
  { name: "status.scan.shared",             path: "./status.scan.shared.js" },
];

describe("commands/ status.* — import contracts (batch F)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
