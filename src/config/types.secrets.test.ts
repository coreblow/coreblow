import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECRET_PROVIDER_ALIAS,
  ENV_SECRET_REF_ID_RE,
  hasConfiguredSecretInput,
  isSecretRef,
  isValidEnvSecretRefId,
  normalizeSecretInputString,
} from "./types.secrets.js";

describe("DEFAULT_SECRET_PROVIDER_ALIAS", () => {
  it("is 'default'", () => {
    expect(DEFAULT_SECRET_PROVIDER_ALIAS).toBe("default");
  });
});

describe("ENV_SECRET_REF_ID_RE", () => {
  it("matches uppercase env var names starting with letter", () => {
    expect(ENV_SECRET_REF_ID_RE.test("MY_API_KEY")).toBe(true);
  });

  it("matches uppercase with numbers", () => {
    expect(ENV_SECRET_REF_ID_RE.test("API_KEY_2")).toBe(true);
  });

  it("rejects lowercase names", () => {
    expect(ENV_SECRET_REF_ID_RE.test("my_key")).toBe(false);
  });

  it("rejects names starting with number", () => {
    expect(ENV_SECRET_REF_ID_RE.test("1_KEY")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(ENV_SECRET_REF_ID_RE.test("")).toBe(false);
  });
});

describe("isValidEnvSecretRefId", () => {
  it("returns true for valid SCREAMING_SNAKE_CASE", () => {
    expect(isValidEnvSecretRefId("OPENAI_API_KEY")).toBe(true);
  });

  it("returns false for lowercase", () => {
    expect(isValidEnvSecretRefId("openai_key")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidEnvSecretRefId("")).toBe(false);
  });

  it("returns false for string with hyphens", () => {
    expect(isValidEnvSecretRefId("MY-KEY")).toBe(false);
  });
});

describe("isSecretRef", () => {
  it("returns false for plain string", () => {
    expect(isSecretRef("secret-value")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSecretRef(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSecretRef(undefined)).toBe(false);
  });

  it("returns boolean for any input", () => {
    expect(typeof isSecretRef({ source: "env", id: "KEY" })).toBe("boolean");
  });
});

describe("hasConfiguredSecretInput", () => {
  it("returns false for undefined", () => {
    expect(hasConfiguredSecretInput(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(hasConfiguredSecretInput(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasConfiguredSecretInput("")).toBe(false);
  });

  it("returns true for non-empty string", () => {
    expect(hasConfiguredSecretInput("my-secret-value")).toBe(true);
  });

  it("returns boolean for any input", () => {
    expect(typeof hasConfiguredSecretInput({ source: "env" })).toBe("boolean");
  });
});

describe("normalizeSecretInputString", () => {
  it("returns string for non-empty string input", () => {
    expect(normalizeSecretInputString("abc")).toBe("abc");
  });

  it("returns undefined for empty string", () => {
    expect(normalizeSecretInputString("")).toBeUndefined();
  });

  it("returns undefined for non-string", () => {
    expect(normalizeSecretInputString(42)).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(normalizeSecretInputString(null)).toBeUndefined();
  });
});
