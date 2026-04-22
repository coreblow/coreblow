import { describe, expect, it } from "vitest";
import {
  AGENT_SCHEMA,
  CHANNEL_SCHEMA,
  SCHEMAS,
  SECURITY_SCHEMA,
  mergeConfigs,
  validateConfig,
} from "./validator.js";

describe("Config schema constants", () => {
  it("AGENT_SCHEMA is a non-null object", () => {
    expect(typeof AGENT_SCHEMA).toBe("object");
    expect(AGENT_SCHEMA).not.toBeNull();
  });

  it("CHANNEL_SCHEMA is a non-null object", () => {
    expect(typeof CHANNEL_SCHEMA).toBe("object");
    expect(CHANNEL_SCHEMA).not.toBeNull();
  });

  it("SECURITY_SCHEMA is a non-null object", () => {
    expect(typeof SECURITY_SCHEMA).toBe("object");
    expect(SECURITY_SCHEMA).not.toBeNull();
  });

  it("SCHEMAS record contains agents key", () => {
    expect("agents" in SCHEMAS).toBe(true);
  });

  it("SCHEMAS record contains channels key", () => {
    expect("channels" in SCHEMAS).toBe(true);
  });

  it("SCHEMAS record contains security key", () => {
    expect("security" in SCHEMAS).toBe(true);
  });

  it("SCHEMAS values are non-null objects", () => {
    for (const [, schema] of Object.entries(SCHEMAS)) {
      expect(typeof schema).toBe("object");
      expect(schema).not.toBeNull();
    }
  });
});

describe("validateConfig", () => {
  it("returns a result object", () => {
    const result = validateConfig({}, AGENT_SCHEMA);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("result has valid field", () => {
    const result = validateConfig({}, AGENT_SCHEMA);
    expect("valid" in result).toBe(true);
  });

  it("does not throw for empty config with AGENT_SCHEMA", () => {
    expect(() => validateConfig({}, AGENT_SCHEMA)).not.toThrow();
  });

  it("does not throw for empty config with CHANNEL_SCHEMA", () => {
    expect(() => validateConfig({}, CHANNEL_SCHEMA)).not.toThrow();
  });
});

describe("mergeConfigs", () => {
  it("does not throw for empty array", () => {
    expect(() => mergeConfigs([])).not.toThrow();
  });

  it("returns an object for empty array", () => {
    const result = mergeConfigs([]);
    expect(typeof result).toBe("object");
  });
});
