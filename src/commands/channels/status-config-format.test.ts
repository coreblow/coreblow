import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";
import { formatConfigChannelsStatusLines } from "./status-config-format.js";

describe("status-config-format", () => {
  it("formats config channels status lines for empty config", async () => {
    const cfg: CoreBlowConfig = {};
    const lines = await formatConfigChannelsStatusLines(cfg, { mode: "local" });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.includes("Gateway not reachable"))).toBe(true);
  });

  it("includes channel information when channels are configured", async () => {
    const cfg: CoreBlowConfig = {
      channels: {
        telegram: {
          enabled: true,
        },
      },
    };
    const lines = await formatConfigChannelsStatusLines(cfg, { mode: "local" });
    expect(lines.some((l) => l.toLowerCase().includes("telegram"))).toBe(true);
  });
});
