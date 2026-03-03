import { describe, it, expect } from "vitest";

describe("dockerfile", () => {
  it("module exists (stub — source file mapping pending)", () => {
    expect(true).toBe(true);
  });

  it.todo("uses shared multi-arch base image refs for all root Node stages");
  it.todo("installs optional browser dependencies after pnpm install");
  it.todo("prunes runtime dependencies after the build stage");
  it.todo("pins bundled plugin discovery to copied source extensions in runtime images");
  it.todo("normalizes plugin and agent paths permissions in image layers");
  it.todo("Docker GPG fingerprint awk uses correct quoting for COREBLOW_SANDBOX=1 build");
  it.todo("keeps runtime pnpm available");
});
