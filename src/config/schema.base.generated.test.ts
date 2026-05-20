import { describe, expect, it } from "vitest";
import { VERSION } from "../version.js";
import { GENERATED_BASE_CONFIG_SCHEMA } from "./schema.base.generated.js";

describe("generated base config schema", () => {
  it("exports a schema object", () => {
    expect(GENERATED_BASE_CONFIG_SCHEMA).toBeDefined();
    expect(typeof GENERATED_BASE_CONFIG_SCHEMA).toBe("object");
  });

  it("matches the runtime CoreBlow version", () => {
    expect(GENERATED_BASE_CONFIG_SCHEMA.version).toBe(VERSION);
  });
});
