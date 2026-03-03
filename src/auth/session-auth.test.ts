/**
 * auth/session-auth.test.ts
 * Tests for SessionAuth — session lifecycle, validation, renewal, limits.
 */
import { describe, expect, it } from "vitest";
import { SessionAuth } from "./session-auth.js";

describe("SessionAuth", () => {
  it("creates session with correct defaults", () => {
    const auth = new SessionAuth();
    const session = auth.create("user-1");
    expect(session.id).toMatch(/^sess-/);
    expect(session.userId).toBe("user-1");
    expect(session.data).toEqual({});
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it("creates session with custom data and metadata", () => {
    const auth = new SessionAuth();
    const session = auth.create("user-1", { role: "admin" }, "127.0.0.1", "Chrome");
    expect(session.data).toEqual({ role: "admin" });
    expect(session.ipAddress).toBe("127.0.0.1");
    expect(session.userAgent).toBe("Chrome");
  });

  it("validates active session", () => {
    const auth = new SessionAuth();
    const session = auth.create("user-1");
    const result = auth.validate(session.id);
    expect(result.valid).toBe(true);
    expect(result.session?.userId).toBe("user-1");
  });

  it("rejects unknown session", () => {
    const auth = new SessionAuth();
    expect(auth.validate("sess-nonexistent").valid).toBe(false);
    expect(auth.validate("sess-nonexistent").error).toBe("Session not found");
  });

  it("destroys session", () => {
    const auth = new SessionAuth();
    const session = auth.create("user-1");
    expect(auth.destroy(session.id)).toBe(true);
    expect(auth.validate(session.id).valid).toBe(false);
  });

  it("destroys all sessions for a user", () => {
    const auth = new SessionAuth();
    auth.create("user-1");
    auth.create("user-1");
    auth.create("user-2");
    expect(auth.destroyAll("user-1")).toBe(2);
    expect(auth.count()).toBe(1);
  });

  it("renews session expiration", () => {
    const auth = new SessionAuth(1000); // 1s expiry
    const session = auth.create("user-1");
    const originalExpiry = session.expiresAt;
    auth.renew(session.id);
    const renewed = auth.validate(session.id);
    expect(renewed.valid).toBe(true);
    expect(renewed.session!.expiresAt).toBeGreaterThanOrEqual(originalExpiry);
  });

  it("enforces max sessions per user", () => {
    const auth = new SessionAuth(3600_000, 2);
    auth.create("alice");
    auth.create("alice");
    auth.create("alice"); // should evict oldest
    expect(auth.count()).toBe(2);
  });

  it("tracks stats", () => {
    const auth = new SessionAuth();
    const s = auth.create("user-1");
    auth.validate(s.id);
    auth.destroy(s.id);
    const stats = auth.getStats();
    expect(stats.created).toBe(1);
    expect(stats.validated).toBe(1);
    expect(stats.destroyed).toBe(1);
  });
});
