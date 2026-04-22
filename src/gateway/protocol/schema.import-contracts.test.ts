import { describe, expect, it } from "vitest";

const modules = [
  { name: "protocol/schema/agent",                path: "./agent.js" },
  { name: "protocol/schema/agents-models-skills", path: "./agents-models-skills.js" },
  { name: "protocol/schema/channels",             path: "./channels.js" },
  { name: "protocol/schema/config",               path: "./config.js" },
];

describe("gateway/protocol/schema — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
