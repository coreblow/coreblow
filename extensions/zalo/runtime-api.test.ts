import { describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNT_ID } from "./runtime-api.js";

describe("zalo runtime api", () => {
  it("exports shared runtime helpers", () => {
    expect(DEFAULT_ACCOUNT_ID).toBe("default");
  });
});
