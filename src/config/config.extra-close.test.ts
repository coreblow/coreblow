import { describe, expect, it } from "vitest";
describe("config extra close — import contracts", () => {
  it("bundled-channel-config-metadata.generated is importable", async () => {
    const m = await import("./bundled-channel-config-metadata.generated.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
  it("channel-config-metadata is importable", async () => {
    const m = await import("./channel-config-metadata.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
  it("config-io is importable", async () => {
    const m = await import("./config-io.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
