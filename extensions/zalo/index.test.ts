import { describe, expect, it } from "vitest";
import plugin, { zaloPlugin } from "./index.js";

describe("zalo index", () => {
  it("exports plugin entry", () => {
    expect(zaloPlugin).toBeDefined();
    expect(plugin).toBeDefined();
  });
});
