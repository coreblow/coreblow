import { describe, it, expect } from "vitest";
import {
  readGatewayCallOptions,
  resolveGatewayOptions,
  callGatewayTool,
  DEFAULT_GATEWAY_URL,
} from "./gateway.js";

describe("gateway — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof readGatewayCallOptions).toBe("function");
    expect(typeof resolveGatewayOptions).toBe("function");
    expect(typeof callGatewayTool).toBe("function");
    expect(DEFAULT_GATEWAY_URL).toBeDefined();
  });
});
