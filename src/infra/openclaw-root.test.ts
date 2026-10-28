import { describe, expect, it } from "vitest";
import {
  resolveCoreBlowPackageRoot,
  resolveCoreBlowPackageRootSync,
} from "./coreblow-root.js";
import {
  resolveOpenClawPackageRoot,
  resolveOpenClawPackageRootSync,
} from "./openclaw-root.js";

describe("openclaw-root compatibility", () => {
  it("delegates async package root resolver to coreblow-root", () => {
    expect(resolveOpenClawPackageRoot).toBe(resolveCoreBlowPackageRoot);
  });

  it("delegates sync package root resolver to coreblow-root", () => {
    expect(resolveOpenClawPackageRootSync).toBe(resolveCoreBlowPackageRootSync);
  });
});
