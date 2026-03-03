/**
 * web/session.test.ts
 * Tests for web SessionManager — create, validate, destroy, cookies.
 */
import { describe, expect, it } from "vitest";
import { SessionManager } from "./session.js";

describe("SessionManager", () => {
  it("creates session with defaults", () => {
    const mgr = new SessionManager();
    const session = mgr.create();
    expect(session.id).toBeDefined();
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(session.data).toEqual({});
  });

  it("creates session with userId and data", () => {
    const mgr = new SessionManager();
    const session = mgr.create("user-1", { role: "admin" });
    expect(session.userId).toBe("user-1");
    expect(session.data).toEqual({ role: "admin" });
  });

  it("validates active session", () => {
    const mgr = new SessionManager();
    const session = mgr.create("user-1");
    expect(mgr.validate(session.id)).not.toBeNull();
    expect(mgr.validate(session.id)?.userId).toBe("user-1");
  });

  it("returns null for unknown session", () => {
    const mgr = new SessionManager();
    expect(mgr.validate("nonexistent")).toBeNull();
  });

  it("destroys session", () => {
    const mgr = new SessionManager();
    const session = mgr.create("user-1");
    expect(mgr.destroy(session.id)).toBe(true);
    expect(mgr.validate(session.id)).toBeNull();
  });

  it("updates session data", () => {
    const mgr = new SessionManager();
    const session = mgr.create("user-1", { count: 0 });
    expect(mgr.update(session.id, { count: 1 })).toBe(true);
    expect(mgr.get(session.id)?.data.count).toBe(1);
  });

  it("touches session to extend expiry", () => {
    const mgr = new SessionManager({ ttlMs: 5000 });
    const session = mgr.create();
    const originalExpiry = session.expiresAt;
    expect(mgr.touch(session.id)).toBe(true);
    expect(mgr.get(session.id)!.expiresAt).toBeGreaterThanOrEqual(originalExpiry);
  });

  it("enforces max sessions by evicting oldest", () => {
    const mgr = new SessionManager({ maxSessions: 2 });
    const s1 = mgr.create("a");
    mgr.create("b");
    mgr.create("c"); // should evict s1
    expect(mgr.get(s1.id)).toBeNull();
    expect(mgr.getActiveCount()).toBe(2);
  });

  it("builds Set-Cookie header", () => {
    const mgr = new SessionManager({ secure: true });
    const cookie = mgr.buildCookie("test-id");
    expect(cookie).toContain("cb-session=test-id");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=");
  });

  it("builds clear cookie header", () => {
    const mgr = new SessionManager();
    const clear = mgr.buildClearCookie();
    expect(clear).toContain("cb-session=");
    expect(clear).toContain("Max-Age=0");
  });

  it("extracts session ID from cookie header", () => {
    const mgr = new SessionManager();
    expect(mgr.extractFromCookie("cb-session=abc123; other=val")).toBe("abc123");
    expect(mgr.extractFromCookie("other=val")).toBeNull();
    expect(mgr.extractFromCookie(undefined)).toBeNull();
  });

  it("uses custom cookie name", () => {
    const mgr = new SessionManager({ cookieName: "my-app" });
    expect(mgr.buildCookie("id1")).toContain("my-app=id1");
    expect(mgr.extractFromCookie("my-app=id1")).toBe("id1");
  });

  it("getActiveCount returns correct count", () => {
    const mgr = new SessionManager();
    mgr.create();
    mgr.create();
    expect(mgr.getActiveCount()).toBe(2);
  });
});
