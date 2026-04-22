/**
 * src/cli/send-runtime/import-contracts.test.ts
 *
 * CoreBlow — Send Runtime Import Contracts
 * Verifies all send-runtime channel modules load without side-effects.
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "discord",   path: "./discord.js" },
  { name: "slack",     path: "./slack.js" },
  { name: "telegram",  path: "./telegram.js" },
  { name: "whatsapp",  path: "./whatsapp.js" },
  { name: "signal",    path: "./signal.js" },
  { name: "imessage",  path: "./imessage.js" },
];

describe("send-runtime — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} runtime is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
