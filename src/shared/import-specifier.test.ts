import { describe, expect, it } from "vitest";
import { toSafeImportPath } from "./import-specifier.js";

describe("toSafeImportPath", () => {
  it("returns the specifier unchanged on non-Windows platforms", () => {
    expect(toSafeImportPath("/abs/path/file.js")).toBe("/abs/path/file.js");
    expect(toSafeImportPath("relative/file.js")).toBe("relative/file.js");
  });

  it("returns file:// URLs unchanged regardless of platform", () => {
    expect(toSafeImportPath("file:///abs/path/file.js")).toBe(
      "file:///abs/path/file.js",
    );
  });
});
