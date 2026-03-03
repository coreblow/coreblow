import { describe, expect, it } from "vitest";
import { snapshotSessionOrigin } from "./metadata.js";

describe("snapshotSessionOrigin()", () => {
  it("returns undefined for undefined entry", () => {
    expect(snapshotSessionOrigin(undefined)).toBeUndefined();
  });

  it("returns undefined for entry with no origin", () => {
    expect(snapshotSessionOrigin({} as never)).toBeUndefined();
  });

  it("returns a copy of origin", () => {
    const origin = { label: "test", provider: "slack" };
    const entry = { origin } as never;
    const result = snapshotSessionOrigin(entry);
    expect(result).toEqual(origin);
    expect(result).not.toBe(origin); // shallow copy
  });

  it("does not mutate original", () => {
    const origin = { label: "original" };
    const entry = { origin } as never;
    const result = snapshotSessionOrigin(entry);
    expect(result?.label).toBe("original");
  });
});
