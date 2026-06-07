import { describe, expect, it } from "vitest";
import { zaloMessageActions } from "./actions.js";

describe("zalo actions", () => {
  it("exports message actions", () => {
    expect(zaloMessageActions).toBeDefined();
  });
});
