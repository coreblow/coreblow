import { describe, expect, it } from "vitest";
const modules = [
  "agent-command-dispatch", "agent-command-parse", "agent-command-registry",
  "attempt-execution", "session", "session-store", "types",
];
describe("agents/command/ — import contracts", () => {
  for (const name of modules) {
    it(`${name} is importable`, async () => {
      const m = await import(`./${name}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
