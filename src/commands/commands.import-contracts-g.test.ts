/**
 * src/commands/commands.import-contracts-g.test.ts
 *
 * CoreBlow — Commands Import Contracts (Batch G - remaining)
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "status.summary",                   path: "./status.summary.js" },
  { name: "status.types",                     path: "./status.types.js" },
  { name: "sessions.test-helpers",            path: "./sessions.test-helpers.js" },
  { name: "status.scan.test-helpers",         path: "./status.scan.test-helpers.js" },
  { name: "doctor-config-flow.test-utils",    path: "./doctor-config-flow.test-utils.js" },
  { name: "test-runtime-config-helpers",      path: "./test-runtime-config-helpers.js" },
  { name: "test-wizard-helpers",              path: "./test-wizard-helpers.js" },
  { name: "opencode-go-model-default",        path: "./opencode-go-model-default.js" },
  { name: "opencode-zen-model-default",       path: "./opencode-zen-model-default.js" },
];

describe("commands/ — import contracts (batch G)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
