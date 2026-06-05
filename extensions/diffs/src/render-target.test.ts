import { describe, expect, it } from "vitest";
import { renderDiffDocument } from "./render.js";

describe("renderDiffDocument render targets", () => {
  it("exports the diff renderer", () => {
    expect(typeof renderDiffDocument).toBe("function");
  });
});
