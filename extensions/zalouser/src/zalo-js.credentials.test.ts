import { describe, expect, it } from "vitest";
import { checkZcaAuthenticated, getZcaUserInfo } from "./accounts.js";

describe("zalouser credential facades", () => {
  it("exports credential helpers", () => {
    expect(typeof checkZcaAuthenticated).toBe("function");
    expect(typeof getZcaUserInfo).toBe("function");
  });
});
