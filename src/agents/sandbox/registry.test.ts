import { describe, it, expect } from "vitest";
import {
  readRegistry,
  updateRegistry,
  removeRegistryEntry,
  readBrowserRegistry,
  updateBrowserRegistry,
  removeBrowserRegistryEntry,
} from "./registry.js";

describe("registry — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof readRegistry).toBe("function");
    expect(typeof updateRegistry).toBe("function");
    expect(typeof removeRegistryEntry).toBe("function");
    expect(typeof readBrowserRegistry).toBe("function");
    expect(typeof updateBrowserRegistry).toBe("function");
    expect(typeof removeBrowserRegistryEntry).toBe("function");
  });
});
