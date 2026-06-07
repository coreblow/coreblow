import { describe, expect, it } from "vitest";
import {
  findBundledSourceForCatalogChannel,
  resolveCatalogChannelSelectionHint,
  resolveQuickstartDefault,
} from "./channel-setup.status.js";

describe("channel setup status", () => {
  it("finds bundled catalog channels and quickstart defaults", () => {
    const bundled = new Map([
      ["telegram", { pluginId: "telegram", localPath: "/tmp/telegram", npmSpec: "@coreblow/telegram" }],
    ]);

    expect(
      findBundledSourceForCatalogChannel({
        channel: "telegram",
        bundled,
      })?.pluginId,
    ).toBe("telegram");
    expect(
      resolveCatalogChannelSelectionHint({
        channel: "telegram",
        bundledSource: bundled.get("telegram"),
      }),
    ).toBe("bundled · enable to use");
    expect(resolveQuickstartDefault(new Map([["telegram", { quickstartScore: 10 }]]))).toBe(
      "telegram",
    );
  });
});
