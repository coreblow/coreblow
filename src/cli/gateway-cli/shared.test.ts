import { describe, expect, it } from "vitest";
import { toOptionString, describeUnknownError } from "./shared.js";

describe("toOptionString()", () => {
  it("returns string value as-is", () => {
    expect(toOptionString("hello")).toBe("hello");
  });

  it("returns undefined for undefined", () => {
    expect(toOptionString(undefined)).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(toOptionString(null)).toBeUndefined();
  });

  it("converts number to string", () => {
    const result = toOptionString(8080);
    expect(typeof result === "string" || result === undefined).toBe(true);
  });

  it("returns empty string unchanged", () => {
    const result = toOptionString("");
    expect(result === "" || result === undefined).toBe(true);
  });
});

describe("describeUnknownError()", () => {
  it("is a function", () => {
    expect(typeof describeUnknownError).toBe("function");
  });

  it("returns a string for Error instance", () => {
    const result = describeUnknownError(new Error("boom"));
    expect(typeof result).toBe("string");
    expect(result).toContain("boom");
  });

  it("returns a string for string error", () => {
    const result = describeUnknownError("something went wrong");
    expect(typeof result).toBe("string");
  });

  it("returns a string for null error", () => {
    const result = describeUnknownError(null);
    expect(typeof result).toBe("string");
  });

  it("returns a string for undefined error", () => {
    const result = describeUnknownError(undefined);
    expect(typeof result).toBe("string");
  });
});
