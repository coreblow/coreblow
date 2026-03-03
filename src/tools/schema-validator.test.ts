import { describe, beforeEach, expect, it } from "vitest";
import { SchemaValidator, type Schema } from "./schema-validator.js";

let validator: SchemaValidator;

beforeEach(() => {
  validator = new SchemaValidator();
});

describe("SchemaValidator — registration", () => {
  it("starts with zero schemas", () => {
    expect(validator.count()).toBe(0);
  });

  it("registers a schema and lists it", () => {
    validator.register("user", { name: { type: "string", required: true } });
    expect(validator.list()).toContain("user");
    expect(validator.count()).toBe(1);
  });

  it("get() returns registered schema", () => {
    const schema: Schema = { age: { type: "number" } };
    validator.register("age-schema", schema);
    expect(validator.get("age-schema")).toEqual(schema);
  });

  it("get() returns null for unknown schema", () => {
    expect(validator.get("nonexistent")).toBeNull();
  });
});

describe("SchemaValidator — validate()", () => {
  beforeEach(() => {
    validator.register("msg", {
      text: { type: "string", required: true },
      count: { type: "number" },
    });
  });

  it("returns valid for correct data", () => {
    const { valid, errors } = validator.validate("msg", { text: "hello", count: 3 });
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it("returns error for missing required field", () => {
    const { valid, errors } = validator.validate("msg", { count: 3 });
    expect(valid).toBe(false);
    expect(errors[0]?.path).toBe("text");
  });

  it("returns error for wrong type", () => {
    const { valid, errors } = validator.validate("msg", { text: 123 as never, count: 3 });
    expect(valid).toBe(false);
    expect(errors[0]?.expected).toBe("string");
  });

  it("returns error for unknown schema name", () => {
    const { valid, errors } = validator.validate("unknown", { text: "x" });
    expect(valid).toBe(false);
    expect(errors[0]?.message).toContain("not found");
  });
});

describe("SchemaValidator — validateDirect()", () => {
  it("validates boolean type directly", () => {
    const schema: Schema = { active: { type: "boolean", required: true } };
    expect(validator.validateDirect({ active: true }, schema).valid).toBe(true);
    expect(validator.validateDirect({ active: "yes" as never }, schema).valid).toBe(false);
  });

  it("validates enum type", () => {
    const schema: Schema = { role: { type: "enum", enum: ["admin", "user"], required: true } };
    expect(validator.validateDirect({ role: "admin" }, schema).valid).toBe(true);
    expect(validator.validateDirect({ role: "superuser" }, schema).valid).toBe(false);
  });

  it("validates array type with items", () => {
    const schema: Schema = { tags: { type: "array", items: { type: "string" } } };
    expect(validator.validateDirect({ tags: ["a", "b"] }, schema).valid).toBe(true);
    expect(validator.validateDirect({ tags: [1, 2] as never }, schema).valid).toBe(false);
  });

  it("validates nested object", () => {
    const schema: Schema = {
      user: {
        type: "object",
        properties: { name: { type: "string", required: true } },
      },
    };
    expect(validator.validateDirect({ user: { name: "Alice" } }, schema).valid).toBe(true);
    expect(validator.validateDirect({ user: { name: 99 as never } }, schema).valid).toBe(false);
  });
});

describe("SchemaValidator — applyDefaults()", () => {
  it("fills in default values for missing fields", () => {
    const schema: Schema = {
      lang: { type: "string", default: "en" },
      count: { type: "number", default: 10 },
    };
    const result = validator.applyDefaults({}, schema);
    expect(result.lang).toBe("en");
    expect(result.count).toBe(10);
  });

  it("does not override existing values", () => {
    const schema: Schema = { lang: { type: "string", default: "en" } };
    const result = validator.applyDefaults({ lang: "id" }, schema);
    expect(result.lang).toBe("id");
  });
});

describe("SchemaValidator — generateSample()", () => {
  it("generates sample with correct types", () => {
    const schema: Schema = {
      name: { type: "string" },
      count: { type: "number" },
      active: { type: "boolean" },
      role: { type: "enum", enum: ["admin", "user"] },
    };
    const sample = validator.generateSample(schema);
    expect(typeof sample.name).toBe("string");
    expect(typeof sample.count).toBe("number");
    expect(typeof sample.active).toBe("boolean");
    expect(sample.role).toBe("admin");
  });
});
