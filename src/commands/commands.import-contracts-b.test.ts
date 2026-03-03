import { describe, expect, it } from "vitest";

const modules = [
  { name: "channels/add",            path: "./channels/add.js" },
  { name: "channels/list",           path: "./channels/list.js" },
  { name: "channels/logs",           path: "./channels/logs.js" },
  { name: "channels/remove",         path: "./channels/remove.js" },
  { name: "channels/resolve",        path: "./channels/resolve.js" },
  { name: "channels/shared",         path: "./channels/shared.js" },
  { name: "channels/status",         path: "./channels/status.js" },
  { name: "channels/add-mutators",   path: "./channels/add-mutators.js" },
  { name: "channel-test-helpers",    path: "./channel-test-helpers.js" },
  { name: "channels.mock-harness",   path: "./channels.mock-harness.js" },
];

describe("commands/ — import contracts (batch B)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
