import { describe, it, expect } from "vitest";
import {
  listMarketplacePlugins,
  resolveMarketplaceInstallShortcut,
  installPluginFromMarketplace,
} from "./marketplace.js";

describe("marketplace — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof listMarketplacePlugins).toBe("function");
    expect(typeof resolveMarketplaceInstallShortcut).toBe("function");
    expect(typeof installPluginFromMarketplace).toBe("function");
  });
});
