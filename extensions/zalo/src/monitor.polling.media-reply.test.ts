import { describe, expect, it } from "vitest";
import { testing } from "./monitor.js";

describe("zalo monitor polling media reply", () => {
  it("exposes monitor testing hooks", () => {
    expect(typeof testing.clearWebhookSecurityState).toBe("function");
  });
});
