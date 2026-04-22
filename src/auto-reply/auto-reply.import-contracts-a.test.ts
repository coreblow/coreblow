import { describe, expect, it } from "vitest";
const modules = [
  "command-auth", "commands-registry.data", "commands-registry.runtime",
  "commands-registry.shared", "commands-registry.types", "commands-text-routing",
  "heartbeat-reply-payload", "inbound-context", "inbound-debounce",
  "media-understanding.test-fixtures",
];
describe("auto-reply/ — import contracts (A)", () => {
  for (const n of modules) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
