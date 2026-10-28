import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";
import {
  getTrustedChannelPluginCatalogEntry,
  listSetupDiscoveryChannelPluginCatalogEntries,
  listTrustedChannelPluginCatalogEntries,
} from "./trusted-catalog.js";

describe("trusted-catalog", () => {
  const emptyConfig: CoreBlowConfig = {};

  it("lists trusted channel plugin catalog entries without crashing", () => {
    const entries = listTrustedChannelPluginCatalogEntries({
      cfg: emptyConfig,
    });
    expect(Array.isArray(entries)).toBe(true);
  });

  it("lists setup discovery channel plugin catalog entries", () => {
    const entries = listSetupDiscoveryChannelPluginCatalogEntries({
      cfg: emptyConfig,
    });
    expect(Array.isArray(entries)).toBe(true);
  });

  it("returns undefined for an unknown channel id", () => {
    const entry = getTrustedChannelPluginCatalogEntry("non-existent-channel-xyz", {
      cfg: emptyConfig,
    });
    expect(entry).toBeUndefined();
  });
});
