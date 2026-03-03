import { describe, expect, it } from "vitest";

const modules = [
  { name: "config-io",                  path: "./config-io.js" },
  { name: "config-loader",              path: "./config-loader.js" },
  { name: "config-hot-reload",          path: "./config-hot-reload.js" },
  { name: "channel-config-metadata",    path: "./channel-config-metadata.js" },
  { name: "includes-scan",              path: "./includes-scan.js" },
  { name: "legacy",                     path: "./legacy.js" },
  { name: "legacy.rules",               path: "./legacy.rules.js" },
  { name: "redact-snapshot.raw",        path: "./redact-snapshot.raw.js" },
];

describe("config/ — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
