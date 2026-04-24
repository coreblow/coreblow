import { describe, it, expect } from "vitest";

import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("resolves all imports without errors", () => {
    expect(buildPlatformRuntimeLogHints).toBeDefined();
    expect(buildPlatformServiceStartHints).toBeDefined();
  });

  it.todo("strips windows drive prefixes from darwin display paths");
});
