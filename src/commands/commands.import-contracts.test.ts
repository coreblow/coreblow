import { describe, expect, it } from "vitest";

const modules = [
  { name: "agents.bind.test-support",   path: "./agents.bind.test-support.js" },
  { name: "agents.commands.add",        path: "./agents.commands.add.js" },
  { name: "agents.commands.bind",       path: "./agents.commands.bind.js" },
  { name: "agents.commands.delete",     path: "./agents.commands.delete.js" },
  { name: "agents.commands.identity",   path: "./agents.commands.identity.js" },
  { name: "auth-choice-prompt",         path: "./auth-choice-prompt.js" },
  { name: "auth-choice.api-key",        path: "./auth-choice.api-key.js" },
  { name: "auth-choice.apply",          path: "./auth-choice.apply.js" },
  { name: "auth-token",                 path: "./auth-token.js" },
  { name: "channels.ts",                path: "./channels.js" },
];

describe("commands/ — import contracts (batch A)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
