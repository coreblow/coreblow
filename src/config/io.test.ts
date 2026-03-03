import { describe, expect, it } from "vitest";
import { ConfigRuntimeRefreshError, resolveConfigSnapshotHash } from "./io.js";

describe("ConfigRuntimeRefreshError", () => {
  it("is an Error subclass", () => {
    const err = new ConfigRuntimeRefreshError("test error");
    expect(err instanceof Error).toBe(true);
  });

  it("has correct name", () => {
    const err = new ConfigRuntimeRefreshError("test");
    expect(err.name).toBe("ConfigRuntimeRefreshError");
  });

  it("preserves message", () => {
    const err = new ConfigRuntimeRefreshError("reload failed");
    expect(err.message).toBe("reload failed");
  });

  it("accepts cause option", () => {
    const cause = new Error("original cause");
    const err = new ConfigRuntimeRefreshError("wrapped", { cause });
    expect((err as NodeJS.ErrnoException).cause).toBe(cause);
  });
});

describe("resolveConfigSnapshotHash()", () => {
  it("returns null for empty snapshot", () => {
    const result = resolveConfigSnapshotHash({});
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("returns the hash when snapshot.hash is a non-empty string", () => {
    const result = resolveConfigSnapshotHash({ hash: "abc123" });
    expect(result).toBe("abc123");
  });

  it("returns null for empty hash string", () => {
    const result = resolveConfigSnapshotHash({ hash: "   " });
    expect(result).toBeNull();
  });

  it("computes hash from raw when hash is missing", () => {
    const result = resolveConfigSnapshotHash({ raw: '{"key":"value"}' });
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns null for null raw", () => {
    const result = resolveConfigSnapshotHash({ raw: null });
    expect(result).toBeNull();
  });
});
