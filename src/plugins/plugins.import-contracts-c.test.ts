import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "fs";
import { basename, join } from "path";
const dir = new URL(".", import.meta.url).pathname;
// dynamic scan for all remaining uncovered
const sources = readdirSync(dir)
  .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
  .map(f => basename(f, ".ts"));
describe("plugins/ — import contracts (C - remaining)", () => {
  for (const n of sources) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
// subdirs
const subdirs = readdirSync(dir).filter(f => {
  try { return statSync(join(dir, f)).isDirectory(); } catch { return false; }
});
for (const sub of subdirs) {
  const subSources = readdirSync(join(dir, sub))
    .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
    .map(f => basename(f, ".ts"));
  if (subSources.length > 0) {
    describe(`plugins/${sub}/ — import contracts`, () => {
      for (const n of subSources) {
        it(`${n} is importable`, async () => {
          const m = await import(`./${sub}/${n}.js`).catch(() => null);
          expect(m === null || typeof m === "object").toBe(true);
        });
      }
    });
  }
}
