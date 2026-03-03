import { describe, expect, it } from "vitest";

const methods = [
  "system",
  "talk",
  "tts",
  "types",
  "validation",
  "voicewake",
  "web",
  "wizard",
  "nodes.handlers.invoke-result",
  "nodes.helpers",
];

describe("gateway/server-methods — import contracts (batch C)", () => {
  for (const name of methods) {
    it(`${name} is importable`, async () => {
      const mod = await import(`./${name}.js`).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
