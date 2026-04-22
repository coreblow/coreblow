import { describe, expect, it } from "vitest";
import { normalizeStoreSessionKey, resolveSessionStoreEntry } from "./store.js";

describe("normalizeStoreSessionKey()", () => {
  it("lowercases input", () => {
    expect(normalizeStoreSessionKey("SESSION-ABC")).toBe("session-abc");
  });

  it("trims whitespace", () => {
    expect(normalizeStoreSessionKey("  session-123  ")).toBe("session-123");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeStoreSessionKey("")).toBe("");
    expect(normalizeStoreSessionKey("   ")).toBe("");
  });

  it("preserves hyphens", () => {
    expect(normalizeStoreSessionKey("session-key-123")).toBe("session-key-123");
  });
});

describe("resolveSessionStoreEntry()", () => {
  it("returns normalizedKey", () => {
    const result = resolveSessionStoreEntry({
      store: {},
      sessionKey: "SESSION-KEY",
    });
    expect(result.normalizedKey).toBe("session-key");
  });

  it("returns existing entry from store when key matches", () => {
    const entry = { id: "s1" } as never;
    const result = resolveSessionStoreEntry({
      store: { "session-key": entry },
      sessionKey: "SESSION-KEY",
    });
    expect(result.existing).toBe(entry);
  });

  it("returns undefined existing when key missing", () => {
    const result = resolveSessionStoreEntry({
      store: {},
      sessionKey: "missing",
    });
    expect(result.existing).toBeUndefined();
  });
});
