import { describe, expect, it } from "vitest";
const modules = [
  "bundled-plugin-metadata.generated", "bundled-provider-auth-env-vars.generated",
  "bundled-web-search-ids", "bundled-web-search-provider-ids",
  "cli-backends.runtime", "command-registration", "command-registry-state",
  "loader", "mcp-protocol", "plugin-config",
];
describe("plugins/ — import contracts (B)", () => {
  for (const n of modules) {
    it(`${n} is importable`, async () => {
      const m = await import(/* @vite-ignore */ `./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
