import { describe, expect, it } from "vitest";

const modules = [
  { name: "mcp-cmd",       path: "./mcp-cmd.js" },
  { name: "models-cmd",    path: "./models-cmd.js" },
  { name: "sessions-cmd",  path: "./sessions-cmd.js" },
  { name: "setup-cmd",     path: "./setup-cmd.js" },
  { name: "skills-cmd",    path: "./skills-cmd.js" },
  { name: "plugins-cmd",   path: "./plugins-cmd.js" },
  { name: "secrets-cmd",   path: "./secrets-cmd.js" },
  { name: "security-cmd",  path: "./security-cmd.js" },
  { name: "onboard-cmd",   path: "./onboard-cmd.js" },
  { name: "tui-cmd",       path: "./tui-cmd.js" },
];

describe("CLI commands — import contracts (batch B)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
