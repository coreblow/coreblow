import { describe, expect, it } from "vitest";
import { validateLineSignature } from "./signature.js";

describe("line signature", () => {
  it("rejects missing signature", () => {
    expect(validateLineSignature("{}", "", "secret")).toBe(false);
  });
});
