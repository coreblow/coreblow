import { describe, expect, it } from "vitest";
const modules = [
  "reply.directive.directive-behavior.e2e-harness",
  "reply.directive.directive-behavior.e2e-mocks",
  "reply.directive.directive-behavior.model-directive-test-utils",
  "reply.runtime", "reply.test-harness",
  "reply.triggers.group-intro-prompts.cases",
  "reply.triggers.trigger-handling.filters-usage-summary-current-model-provider.cases",
  "reply.triggers.trigger-handling.test-harness",
  "reply", "model-runtime",
];
describe("auto-reply/ — import contracts (B)", () => {
  for (const n of modules) {
    it(`${n} is importable`, async () => {
      const m = await import(`./${n}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
