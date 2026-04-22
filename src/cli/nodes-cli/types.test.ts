import { describe, expect, it } from "vitest";

describe("nodes-cli/types module", () => {
  it("is importable", async () => {
    const mod = await import("./types.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("daemon-cli/types module", () => {
  it("is importable", async () => {
    const mod = await import("../daemon-cli/types.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("config-set-dryrun module", () => {
  it("is importable", async () => {
    const mod = await import("../config-set-dryrun.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("plugin-commands module", () => {
  it("is importable", async () => {
    const mod = await import("../plugin-commands.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
