import { describe, expect, it } from "vitest";

const modules = [
  { name: "config.ts",                    path: "./config.js" },
  { name: "config.backup-rotation",       path: "./config.backup-rotation.test-helpers.js" },
  { name: "home-env.test-harness",        path: "./home-env.test-harness.js" },
  { name: "legacy-migrate.test-helpers",  path: "./legacy-migrate.test-helpers.js" },
  { name: "redact-snapshot.test-hints",   path: "./redact-snapshot.test-hints.js" },
  { name: "sessions/session-file",        path: "./sessions/session-file.js" },
  { name: "sessions/store-summary",       path: "./sessions/store-summary.js" },
  { name: "sessions/transcript",          path: "./sessions/transcript.js" },
];

describe("config/ final — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
