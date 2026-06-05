import { describe, expect, it } from "vitest";
import plugin from "./index.js";

describe("bonjour plugin entry", () => {
  it("exports a CoreBlow plugin entry", () => {
    expect(plugin.id).toBe("bonjour");
    expect(typeof plugin.register).toBe("function");
  });
});
