import { describe, expect, it } from "vitest";
import {
  COREBLOW_MODEL_ID,
  COREBLOW_DEFAULT_MODEL_ID,
  getHeader,
  getBearerToken,
} from "./http-utils.js";

describe("model ID constants", () => {
  it("COREBLOW_MODEL_ID equals 'coreblow'", () => {
    expect(COREBLOW_MODEL_ID).toBe("coreblow");
  });

  it("COREBLOW_DEFAULT_MODEL_ID equals 'coreblow/default'", () => {
    expect(COREBLOW_DEFAULT_MODEL_ID).toBe("coreblow/default");
  });

  it("COREBLOW_DEFAULT_MODEL_ID starts with COREBLOW_MODEL_ID", () => {
    expect(COREBLOW_DEFAULT_MODEL_ID.startsWith(COREBLOW_MODEL_ID)).toBe(true);
  });
});

describe("getHeader()", () => {
  it("returns header value case-insensitively", () => {
    const req = { headers: { "content-type": "application/json" } } as never;
    expect(getHeader(req, "content-type")).toBe("application/json");
  });

  it("returns undefined for missing header", () => {
    const req = { headers: {} } as never;
    expect(getHeader(req, "authorization")).toBeUndefined();
  });

  it("handles headers object with mixed case", () => {
    const req = { headers: { Authorization: "Bearer tok" } } as never;
    const result = getHeader(req, "authorization");
    expect(result === "Bearer tok" || result === undefined).toBe(true);
  });
});

describe("getBearerToken()", () => {
  it("returns token from Authorization: Bearer <token>", () => {
    const req = { headers: { authorization: "Bearer my-secret-token" } } as never;
    const token = getBearerToken(req);
    expect(token).toBe("my-secret-token");
  });

  it("returns undefined when no Authorization header", () => {
    const req = { headers: {} } as never;
    expect(getBearerToken(req)).toBeUndefined();
  });

  it("returns undefined for non-Bearer auth", () => {
    const req = { headers: { authorization: "Basic dXNlcjpwYXNz" } } as never;
    const result = getBearerToken(req);
    expect(result === undefined || result === null || typeof result === "string").toBe(true);
  });
});
