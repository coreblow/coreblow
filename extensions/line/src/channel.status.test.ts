import { describe, expect, it } from "vitest";
import { lineStatusAdapter } from "./status.js";

describe("line channel status", () => {
  it("exposes the status adapter facade", () => {
    expect(lineStatusAdapter).toBeDefined();
  });
});
