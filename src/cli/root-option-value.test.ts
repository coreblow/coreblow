/**
 * src/cli/root-option-value.test.ts
 *
 * CoreBlow — Root Option Value Tests
 * Verifies takeCliRootOptionValue: =value, next-token, null cases.
 */
import { describe, expect, it } from "vitest";
import { takeCliRootOptionValue } from "./root-option-value.js";

describe("takeCliRootOptionValue()", () => {
  it("parses inline =value format", () => {
    const r = takeCliRootOptionValue("--profile=production", undefined);
    expect(r.value).toBe("production");
    expect(r.consumedNext).toBe(false);
  });

  it("returns null value for =empty inline", () => {
    const r = takeCliRootOptionValue("--profile=", undefined);
    expect(r.value).toBeNull();
    expect(r.consumedNext).toBe(false);
  });

  it("returns null value for =whitespace inline", () => {
    const r = takeCliRootOptionValue("--profile=   ", undefined);
    expect(r.value).toBeNull();
  });

  it("consumes next token when no = and next is a value token", () => {
    const r = takeCliRootOptionValue("--profile", "production");
    expect(r.consumedNext).toBe(true);
    expect(r.value).toBe("production");
  });

  it("returns null and consumedNext=false when next is undefined", () => {
    const r = takeCliRootOptionValue("--profile", undefined);
    expect(r.value).toBeNull();
    expect(r.consumedNext).toBe(false);
  });

  it("returns object with both value and consumedNext fields", () => {
    const r = takeCliRootOptionValue("--profile=dev", undefined);
    expect("value" in r).toBe(true);
    expect("consumedNext" in r).toBe(true);
  });
});
