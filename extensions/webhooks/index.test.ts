import { describe, expect, it } from "vitest";
import plugin from "./index.js";

describe("webhooks plugin entry", () => {
  it("exports a CoreBlow plugin entry", () => {
    expect(plugin.id).toBe("webhooks");
    expect(typeof plugin.register).toBe("function");
  });
});
