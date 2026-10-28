import { describe, expect, it } from "vitest";
import {
  POSIX_COREBLOW_TMP_DIR,
  resolvePreferredCoreBlowTmpDir,
} from "./tmp-coreblow-dir.js";
import {
  POSIX_OPENCLAW_TMP_DIR,
  resolvePreferredOpenClawTmpDir,
} from "./tmp-openclaw-dir.js";

describe("tmp-openclaw-dir compatibility", () => {
  it("aliases CoreBlow preferred tmp dir resolvers and constants", () => {
    expect(resolvePreferredOpenClawTmpDir).toBe(resolvePreferredCoreBlowTmpDir);
    expect(POSIX_OPENCLAW_TMP_DIR).toBe(POSIX_COREBLOW_TMP_DIR);
  });
});
