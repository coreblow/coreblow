import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPluginSdkTestHarness } from "./test-helpers.js";

describe("createPluginSdkTestHarness", () => {
  const harness = createPluginSdkTestHarness();

  it("creates a fresh async temp directory that exists on disk", async () => {
    const dir = await harness.createTempDir("async-case-");
    expect(existsSync(dir)).toBe(true);
  });

  it("creates a fresh sync temp directory that exists on disk", () => {
    const dir = harness.createTempDirSync("sync-case-");
    expect(existsSync(dir)).toBe(true);
  });

  it("returns distinct directories across calls", async () => {
    const first = await harness.createTempDir("dup-");
    const second = await harness.createTempDir("dup-");
    expect(first).not.toBe(second);
  });
});
