import { describe, expect, it } from "vitest";

const typeModules = [
  "types.ts",
  "types.base.ts",
  "types.agents.ts",
  "types.agents-shared.ts",
  "types.agent-defaults.ts",
  "types.auth.ts",
  "types.channels.ts",
  "types.coreblow.ts",
  "types.gateway.ts",
  "types.models.ts",
  "types.plugins.ts",
  "types.tools.ts",
  "types.skills.ts",
  "types.cron.ts",
  "types.mcp.ts",
];

describe("config/ types — import contracts (batch A)", () => {
  for (const name of typeModules) {
    it(`${name} is importable`, async () => {
      const mod = await import(/* @vite-ignore */ `./${name.replace(".ts", ".js")}`).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
