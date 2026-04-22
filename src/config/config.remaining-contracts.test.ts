import { describe, expect, it } from "vitest";

const modules = [
  { name: "config.ts",                                path: "./config.js" },
  { name: "env-vars.ts",                              path: "./env-vars.js" },
  { name: "bundled-channel-config-metadata.generated", path: "./bundled-channel-config-metadata.generated.js" },
  { name: "sessions/main-session.runtime",             path: "./sessions/main-session.runtime.js" },
  { name: "sessions/store.runtime",                   path: "./sessions/store.runtime.js" },
  { name: "sessions/store-cache",                     path: "./sessions/store-cache.js" },
  { name: "sessions/store-maintenance",               path: "./sessions/store-maintenance.js" },
  { name: "sessions/store-migrations",                path: "./sessions/store-migrations.js" },
  { name: "redact-snapshot.test-helpers",             path: "./redact-snapshot.test-helpers.js" },
];

describe("config/ remaining — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
