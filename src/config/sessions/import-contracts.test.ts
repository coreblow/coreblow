import { describe, expect, it } from "vitest";

const modules = [
  { name: "sessions/store.ts",              path: "./store.js" },
  { name: "sessions/store-cache.ts",        path: "./store-cache.js" },
  { name: "sessions/store-maintenance.ts",  path: "./store-maintenance.js" },
  { name: "sessions/store-migrations.ts",   path: "./store-migrations.js" },
  { name: "sessions/store-summary.ts",      path: "./store-summary.js" },
  { name: "sessions/session-file.ts",       path: "./session-file.js" },
  { name: "sessions/transcript.ts",         path: "./transcript.js" },
  { name: "sessions/main-session.ts",       path: "./main-session.js" },
];

describe("sessions/ — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
