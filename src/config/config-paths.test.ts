import { describe, it, expect } from "vitest";
import {
  parseConfigPath,
  setConfigValueAtPath,
  unsetConfigValueAtPath,
  getConfigValueAtPath,
} from "./config-paths.js";

describe("parseConfigPath", () => {
  it("parses valid dot-notation paths", () => {
    const result = parseConfigPath("gateway.auth.token");
    expect(result.ok).toBe(true);
    expect(result.path).toEqual(["gateway", "auth", "token"]);
  });

  it("trims whitespace in segments", () => {
    const result = parseConfigPath("  gateway . auth . token  ");
    expect(result.ok).toBe(true);
    expect(result.path).toEqual(["gateway", "auth", "token"]);
  });

  it("rejects empty paths", () => {
    expect(parseConfigPath("").ok).toBe(false);
    expect(parseConfigPath("   ").ok).toBe(false);
  });

  it("rejects paths with empty segments", () => {
    expect(parseConfigPath("gateway..token").ok).toBe(false);
    expect(parseConfigPath(".gateway.token").ok).toBe(false);
    expect(parseConfigPath("gateway.token.").ok).toBe(false);
  });

  it("rejects paths with blocked prototype keys", () => {
    expect(parseConfigPath("__proto__").ok).toBe(false);
    expect(parseConfigPath("gateway.__proto__").ok).toBe(false);
    expect(parseConfigPath("constructor.prototype").ok).toBe(false);
  });
});

describe("setConfigValueAtPath", () => {
  it("sets value at nested path, creating intermediates", () => {
    const root: Record<string, unknown> = {};
    setConfigValueAtPath(root, ["gateway", "auth", "token"], "my-token");
    expect((root.gateway as any).auth.token).toBe("my-token");
  });

  it("overwrites existing value", () => {
    const root: Record<string, unknown> = { gateway: { port: 8080 } };
    setConfigValueAtPath(root, ["gateway", "port"], 9090);
    expect((root.gateway as any).port).toBe(9090);
  });

  it("sets value at top-level path", () => {
    const root: Record<string, unknown> = {};
    setConfigValueAtPath(root, ["name"], "CoreBlow");
    expect(root.name).toBe("CoreBlow");
  });
});

describe("unsetConfigValueAtPath", () => {
  it("removes a leaf value and returns true", () => {
    const root: Record<string, unknown> = { gateway: { auth: { token: "tok" } } };
    const result = unsetConfigValueAtPath(root, ["gateway", "auth", "token"]);
    expect(result).toBe(true);
    expect((root.gateway as any)?.auth?.token).toBeUndefined();
  });

  it("cleans up empty parent objects", () => {
    const root: Record<string, unknown> = { gateway: { auth: { token: "tok" } } };
    unsetConfigValueAtPath(root, ["gateway", "auth", "token"]);
    // auth should be cleaned up since it's now empty
    expect((root.gateway as any)?.auth).toBeUndefined();
    // gateway should also be cleaned up
    expect(root.gateway).toBeUndefined();
  });

  it("preserves sibling values during cleanup", () => {
    const root: Record<string, unknown> = { gateway: { port: 8080, auth: { token: "tok" } } };
    unsetConfigValueAtPath(root, ["gateway", "auth", "token"]);
    expect((root.gateway as any).port).toBe(8080);
  });

  it("returns false for non-existent path", () => {
    const root: Record<string, unknown> = {};
    expect(unsetConfigValueAtPath(root, ["nonexistent", "path"])).toBe(false);
  });

  it("returns false for non-existent leaf", () => {
    const root: Record<string, unknown> = { gateway: {} };
    expect(unsetConfigValueAtPath(root, ["gateway", "missing"])).toBe(false);
  });
});

describe("getConfigValueAtPath", () => {
  it("gets value at path", () => {
    const root = { gateway: { auth: { token: "my-token" } } };
    expect(getConfigValueAtPath(root, ["gateway", "auth", "token"])).toBe("my-token");
  });

  it("returns undefined for non-existent path", () => {
    const root = { gateway: {} };
    expect(getConfigValueAtPath(root, ["gateway", "auth", "token"])).toBeUndefined();
  });

  it("returns object for intermediate path", () => {
    const root = { gateway: { auth: { token: "tok" } } };
    expect(getConfigValueAtPath(root, ["gateway", "auth"])).toEqual({ token: "tok" });
  });

  it("returns undefined when traversing through non-object", () => {
    const root = { gateway: "string-value" };
    expect(getConfigValueAtPath(root, ["gateway", "auth"])).toBeUndefined();
  });
});
