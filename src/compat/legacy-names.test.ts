import { describe, expect, it } from "vitest";
import {
  LEGACY_MACOS_APP_SOURCES_DIRS,
  LEGACY_MANIFEST_KEYS,
  MACOS_APP_SOURCES_DIR,
  MANIFEST_KEY,
  PROJECT_NAME,
} from "./legacy-names.js";

describe("compat/legacy-names", () => {
  it("keeps CoreBlow names primary without OpenClaw legacy aliases", () => {
    expect(PROJECT_NAME).toBe("coreblow");
    expect(MANIFEST_KEY).toBe("coreblow");
    expect(LEGACY_MANIFEST_KEYS).toEqual([]);
    expect(MACOS_APP_SOURCES_DIR).toBe("apps/macos/Sources/CoreBlow");
    expect(LEGACY_MACOS_APP_SOURCES_DIRS).toEqual([]);
  });
});
