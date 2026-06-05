import { describe, expect, it } from "vitest";
import { CoreBlow, EventHub, GatewayClientTransport, normalizeGatewayEvent } from "./index.js";

describe("CoreBlow SDK e2e facade", () => {
  it("exports the public client, transport, events, and normalizer", () => {
    expect(typeof CoreBlow).toBe("function");
    expect(typeof EventHub).toBe("function");
    expect(typeof GatewayClientTransport).toBe("function");
    expect(typeof normalizeGatewayEvent).toBe("function");
  });
});
