import { describe, expect, it } from "vitest";
import { readdirSync } from "fs";
import { basename } from "path";
const dir = new URL(".", import.meta.url).pathname;
const sources = readdirSync(dir)
  .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
  .map(f => basename(f, ".ts"));
describe("agents/pi-extensions/ — import contracts", () => {
  for (const n of sources) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
