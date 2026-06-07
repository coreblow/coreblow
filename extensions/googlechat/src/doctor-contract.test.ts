import { describe, expect, it } from "vitest";
import { normalizeCompatibilityConfig } from "./doctor-contract.js";

describe("googlechat doctor contract", () => {
  it("removes legacy streamMode", () => {
    const result = normalizeCompatibilityConfig({
      cfg: { channels: { googlechat: { streamMode: "legacy" } as never } },
    });
    expect(result.changes).toHaveLength(1);
    expect(result.config.channels?.googlechat).not.toHaveProperty("streamMode");
  });
});
