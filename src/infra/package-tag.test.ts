import { describe, expect, it } from "vitest";
import { normalizePackageTagInput } from "./package-tag.js";

describe("normalizePackageTagInput", () => {
  const packageNames = ["coreblow", "@coreblow/plugin"] as const;

  it.each([
    { input: undefined, expected: null },
    { input: "   ", expected: null },
    { input: "coreblow@beta", expected: "beta" },
    { input: "@coreblow/plugin@2026.2.24", expected: "2026.2.24" },
    { input: "coreblow@   ", expected: null },
    { input: "coreblow", expected: null },
    { input: " @coreblow/plugin ", expected: null },
    { input: " latest ", expected: "latest" },
    { input: "@other/plugin@beta", expected: "@other/plugin@beta" },
    { input: "coreblower@beta", expected: "coreblower@beta" },
  ] satisfies ReadonlyArray<{ input: string | undefined; expected: string | null }>)(
    "normalizes %j",
    ({ input, expected }) => {
      expect(normalizePackageTagInput(input, packageNames)).toBe(expected);
    },
  );
});
