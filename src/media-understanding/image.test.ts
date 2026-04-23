import { describe, it, expect } from "vitest";
import {
  describeImagesWithModel,
  describeImageWithModel,
} from "./image.js";

describe("image — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof describeImagesWithModel).toBe("function");
    expect(typeof describeImageWithModel).toBe("function");
  });
});
