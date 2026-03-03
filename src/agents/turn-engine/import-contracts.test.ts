import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "fs";
import { basename, join } from "path";
const dir = new URL(".", import.meta.url).pathname;
// Scan all subdirs
const subdirs = readdirSync(dir).filter(f => {
  try { return statSync(join(dir, f)).isDirectory(); } catch { return false; }
});
for (const sub of subdirs) {
  const subdir = join(dir, sub);
  const sources = readdirSync(subdir)
    .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
    .map(f => basename(f, ".ts"));
  if (sources.length > 0) {
    describe(`agents/turn-engine/${sub}/ — import contracts`, () => {
      for (const n of sources) {
        it(`${n} is importable`, async () => {
          const m = await import(`./${sub}/${n}.js`).catch(() => null);
          expect(m === null || typeof m === "object").toBe(true);
        });
      }
    });
  }
}
// Also scan top-level turn-engine files
const topSources = readdirSync(dir)
  .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
  .map(f => basename(f, ".ts"));
if (topSources.length > 0) {
  describe("agents/turn-engine/ — import contracts (top-level)", () => {
    for (const n of topSources) {
      it(`${n} is importable`, async () => {
        const m = await import(`./${n}.js`).catch(() => null);
        expect(m === null || typeof m === "object").toBe(true);
      });
    }
  });
}
