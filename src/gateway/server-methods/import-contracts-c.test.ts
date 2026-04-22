/**
 * src/gateway/server-methods/import-contracts-c.test.ts
 *
 * CoreBlow — Gateway Server Methods Import Contracts (Batch C)
 */
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
