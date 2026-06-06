import { describe, expect, it } from "vitest";
import {
  AUTO_MANAGED_CONFIG_META_FIELDS,
  AUTO_MANAGED_CONFIG_META_PATHS,
  stampConfigWriteMetadata,
} from "./io.meta.js";

describe("config write metadata", () => {
  it("stamps managed meta fields without dropping existing metadata", () => {
    expect(
      stampConfigWriteMetadata(
        { meta: { profile: "local" } } as any,
        "2026-06-06T00:00:00.000Z",
        "1.2.3",
      ),
    ).toEqual({
      meta: {
        profile: "local",
        lastTouchedVersion: "1.2.3",
        lastTouchedAt: "2026-06-06T00:00:00.000Z",
      },
    });
  });

  it("exports managed field names and paths", () => {
    expect(AUTO_MANAGED_CONFIG_META_FIELDS.lastTouchedVersion).toBe("lastTouchedVersion");
    expect(AUTO_MANAGED_CONFIG_META_PATHS).toEqual([
      ["meta", "lastTouchedVersion"],
      ["meta", "lastTouchedAt"],
    ]);
  });
});
