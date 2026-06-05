import { describe, expect, it } from "vitest";
import { createTaskFlowWebhookRequestHandler } from "./http.js";

describe("webhooks HTTP facade", () => {
  it("exports a request handler factory", () => {
    expect(typeof createTaskFlowWebhookRequestHandler).toBe("function");
  });
});
