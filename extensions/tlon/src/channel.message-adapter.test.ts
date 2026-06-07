import { describe, expect, it } from "vitest";
import { tlonPlugin } from "./channel.js";

describe("tlon channel message adapter", () => {
  it("exposes the Tlon channel plugin metadata", () => {
    expect(tlonPlugin.id).toBe("tlon");
    expect(tlonPlugin.capabilities?.reply).toBe(true);
    expect(tlonPlugin.config).toBeDefined();
  });
});
