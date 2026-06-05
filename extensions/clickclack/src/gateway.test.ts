import { describe, expect, it } from "vitest";
import { startClickClackGatewayAccount } from "./gateway.js";

describe("clickclack gateway facade", () => {
  it("exports a gateway starter", () => {
    expect(typeof startClickClackGatewayAccount).toBe("function");
  });
});
