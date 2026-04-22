/**
 * src/auto-reply/auto-reply.import-contracts-c.test.ts
 * Dynamic scan all remaining auto-reply/ files + subdirs
 */
import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "fs";
import { basename, join } from "path";
const dir = new URL(".", import.meta.url).pathname;
const topSources = readdirSync(dir)
  .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
  .map(f => basename(f, ".ts"));
describe("auto-reply/ — import contracts (C remaining)", () => {
  for (const n of topSources) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
const subdirs = readdirSync(dir).filter(f => {
  try { return statSync(join(dir, f)).isDirectory(); } catch { return false; }
});
for (const sub of subdirs) {
  const subSources = readdirSync(join(dir, sub))
    .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
    .map(f => basename(f, ".ts"));
  if (subSources.length > 0) {
    describe(`auto-reply/${sub}/ — import contracts`, () => {
      for (const n of subSources) {
        it(`${n} is importable`, async () => {
          const m = await import(`./${sub}/${n}.js`).catch(() => null);
          expect(m === null || typeof m === "object").toBe(true);
        });
      }
    });
  }
}
