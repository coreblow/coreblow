import { describe, expect, it } from "vitest";
import { LineConfigSchema } from "./config-schema.js";

describe("line config schema", () => {
  it("is importable through the compatibility test surface", () => {
    expect(LineConfigSchema).toBeDefined();
  });
});
