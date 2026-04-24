/**
 * auth/api-key-manager.test.ts
 * Comprehensive tests for ApiKeyManager — creation, validation, rotation, scoping.
 */
import { describe, expect, it } from "vitest";
import { ApiKeyManager } from "./api-key-manager.js";

describe("ApiKeyManager", () => {
  it("creates a key with correct defaults", () => {
    const mgr = new ApiKeyManager();
    const key = mgr.create("test-key", "alice");
    expect(key.id).toBe("apikey-1");
    expect(key.key).toMatch(/^cb_/);
    expect(key.name).toBe("test-key");
    expect(key.owner).toBe("alice");
    expect(key.scopes).toEqual(["*"]);
    expect(key.rateLimit).toBe(1000);
    expect(key.usage).toBe(0);
    expect(key.active).toBe(true);
  });

  it("validates a valid key", () => {
    const mgr = new ApiKeyManager();
    const key = mgr.create("k1", "alice");
    const result = mgr.validate(key.key);
    expect(result.valid).toBe(true);
    expect(result.apiKey?.id).toBe(key.id);
  });

  it("rejects unknown keys", () => {
    const mgr = new ApiKeyManager();
    const result = mgr.validate("cb_nonexistent");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Key not found");
  });

  it("rejects inactive keys", () => {
    const mgr = new ApiKeyManager();
    const key = mgr.create("k1", "alice");
    mgr.deactivate(key.id);
    expect(mgr.validate(key.key).valid).toBe(false);
    expect(mgr.validate(key.key).error).toBe("Key inactive");
  });

  it("rejects keys exceeding rate limit", () => {
    const mgr = new ApiKeyManager();
    const key = mgr.create("k1", "alice", ["*"], 2);
    expect(mgr.validate(key.key).valid).toBe(true);
    expect(mgr.validate(key.key).valid).toBe(true);
    expect(mgr.validate(key.key).valid).toBe(false);
    expect(mgr.validate(key.key).error).toBe("Rate limit exceeded");
  });

  it("enforces scope restrictions", () => {
    const mgr = new ApiKeyManager();
    const key = mgr.create("k1", "alice", ["read", "write"]);
    expect(mgr.validate(key.key, "read").valid).toBe(true);
    expect(mgr.validate(key.key, "admin").valid).toBe(false);
    expect(mgr.validate(key.key, "admin").error).toBe("Insufficient scope");
  });

  it("wildcard scope grants all access", () => {
    const mgr = new ApiKeyManager();
    const key = mgr.create("k1", "alice", ["*"]);
    expect(mgr.validate(key.key, "admin").valid).toBe(true);
    expect(mgr.validate(key.key, "anything").valid).toBe(true);
  });

  it("rotates key preserving identity", () => {
    const mgr = new ApiKeyManager();
    const key = mgr.create("k1", "alice");
    const oldKey = key.key;
    const rotated = mgr.rotate(key.id);
    expect(rotated).not.toBeNull();
    expect(rotated!.id).toBe(key.id);
    expect(rotated!.key).not.toBe(oldKey);
    expect(mgr.validate(oldKey).valid).toBe(false);
    expect(mgr.validate(rotated!.key).valid).toBe(true);
  });

  it("lists keys by owner", () => {
    const mgr = new ApiKeyManager();
    mgr.create("k1", "alice");
    mgr.create("k2", "alice");
    mgr.create("k3", "bob");
    expect(mgr.listByOwner("alice")).toHaveLength(2);
    expect(mgr.listByOwner("bob")).toHaveLength(1);
    expect(mgr.listByOwner("charlie")).toHaveLength(0);
  });

  it("tracks stats correctly", () => {
    const mgr = new ApiKeyManager();
    const key = mgr.create("k1", "alice");
    mgr.validate(key.key);
    mgr.validate("cb_bad");
    mgr.rotate(key.id);
    const stats = mgr.getStats();
    expect(stats.created).toBe(1);
    expect(stats.validated).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.rotated).toBe(1);
  });

  it("count reflects key inventory", () => {
    const mgr = new ApiKeyManager();
    expect(mgr.count()).toBe(0);
    mgr.create("k1", "alice");
    mgr.create("k2", "bob");
    expect(mgr.count()).toBe(2);
  });
});
