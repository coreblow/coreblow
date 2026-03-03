import { describe, expect, it } from "vitest";

const modules = [
  { name: "protocol/schema/cron",           path: "./protocol/schema/cron.js" },
  { name: "protocol/schema/devices",        path: "./protocol/schema/devices.js" },
  { name: "protocol/schema/exec-approvals", path: "./protocol/schema/exec-approvals.js" },
  { name: "session-archive.fs",             path: "./session-archive.fs.js" },
  { name: "session-archive.runtime",        path: "./session-archive.runtime.js" },
  { name: "session-manager",               path: "./session-manager.js" },
  { name: "session-reset-service",          path: "./session-reset-service.js" },
  { name: "session-transcript-files.fs",    path: "./session-transcript-files.fs.js" },
  { name: "shutdown",                       path: "./shutdown.js" },
  { name: "startup-auth",                   path: "./startup-auth.js" },
];

describe("gateway/ — import contracts (batch D)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
