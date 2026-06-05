import { describe, expect, it } from "vitest";
import { handleClickClackInbound } from "./inbound.js";

describe("clickclack inbound facade", () => {
  it("exports an inbound handler", () => {
    expect(typeof handleClickClackInbound).toBe("function");
  });
});
