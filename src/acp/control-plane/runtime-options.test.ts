import { describe, expect, it } from "vitest";
import {
  buildRuntimeConfigOptionPairs,
  resolveRuntimeConfigOptionKey,
} from "./runtime-options.js";

describe("ACP runtime option wire keys", () => {
  it("uses aliases advertised by the runtime", () => {
    expect(resolveRuntimeConfigOptionKey("approval_policy", ["permission_mode"])).toBe(
      "permission_mode",
    );
    expect(
      buildRuntimeConfigOptionPairs(
        { permissionProfile: "strict", timeoutSeconds: 30 },
        ["permissions", "timeout_seconds"],
      ),
    ).toEqual([
      ["permissions", "strict"],
      ["timeout_seconds", "30"],
    ]);
  });
});
