import { describe, it, expect } from "vitest";
import {
  startGatewayBonjourAdvertiser,
  BonjourAdvertiserService,
} from "./bonjour.js";

describe("bonjour — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof startGatewayBonjourAdvertiser).toBe("function");
    expect(typeof BonjourAdvertiserService).toBe("function");
  });
});
