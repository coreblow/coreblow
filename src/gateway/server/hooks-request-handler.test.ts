import { describe, expect, it } from "vitest";
import { createHooksRequestHandler } from "./hooks-request-handler.js";

describe("gateway/server/hooks-request-handler", () => {
  it("re-exports the hooks request handler factory from the CoreBlow HTTP runtime", () => {
    expect(typeof createHooksRequestHandler).toBe("function");
  });
});
