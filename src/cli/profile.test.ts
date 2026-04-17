import { describe, expect, it } from "vitest";
import { parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway subcommand args untouched", () => {
    const res = parseCliProfileArgs([
      "node", "coreblow", "gateway", "--dev", "--allow-unconfigured",
    ]);
    if (!res.ok) throw new Error(res.error);
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "coreblow", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("parses profile from --profile flag", () => {
    const res = parseCliProfileArgs(["node", "coreblow", "--profile", "dev", "gateway"]);
    if (!res.ok) throw new Error(res.error);
    expect(res.profile).toBe("dev");
  });

  it("returns error for missing profile value", () => {
    const res = parseCliProfileArgs(["node", "coreblow", "--profile"]);
    expect(res.ok).toBe(false);
  });
});
