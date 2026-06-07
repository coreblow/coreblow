import { describe, expect, it } from "vitest";
import { testing } from "./monitor.js";

describe("googlechat monitor durable state", () => {
  it("clears webhook targets for tests", () => {
    expect(() => testing.clearWebhookTargets()).not.toThrow();
  });
});
