/**
 * src/gateway/control-plane-audit.test.ts
 *
 * CoreBlow — Control Plane Audit Tests
 * Verifies resolveControlPlaneActor, formatControlPlaneActor,
 * and summarizeChangedPaths.
 */
import { describe, expect, it } from "vitest";
import {
  resolveControlPlaneActor,
  formatControlPlaneActor,
  summarizeChangedPaths,
} from "./control-plane-audit.js";

describe("resolveControlPlaneActor()", () => {
  it("returns fallback values for null client", () => {
    const actor = resolveControlPlaneActor(null);
    expect(actor.actor).toBe("unknown-actor");
    expect(actor.deviceId).toBe("unknown-device");
    expect(actor.clientIp).toBe("unknown-ip");
    expect(actor.connId).toBe("unknown-conn");
  });

  it("uses client data when present", () => {
    const client = {
      connect: {
        client: { id: "client-abc" },
        device: { id: "dev-xyz" },
      },
      clientIp: "10.0.0.1",
      connId: "conn-999",
    } as never;
    const actor = resolveControlPlaneActor(client);
    expect(actor.actor).toBe("client-abc");
    expect(actor.deviceId).toBe("dev-xyz");
    expect(actor.clientIp).toBe("10.0.0.1");
    expect(actor.connId).toBe("conn-999");
  });

  it("returns an object with all four fields", () => {
    const actor = resolveControlPlaneActor(null);
    expect("actor" in actor).toBe(true);
    expect("deviceId" in actor).toBe(true);
    expect("clientIp" in actor).toBe(true);
    expect("connId" in actor).toBe(true);
  });
});

describe("formatControlPlaneActor()", () => {
  it("returns a non-empty string", () => {
    const actor = resolveControlPlaneActor(null);
    const str = formatControlPlaneActor(actor);
    expect(typeof str).toBe("string");
    expect(str.length).toBeGreaterThan(0);
  });

  it("contains actor= and device= labels", () => {
    const actor = resolveControlPlaneActor(null);
    const str = formatControlPlaneActor(actor);
    expect(str).toContain("actor=");
    expect(str).toContain("device=");
  });
});

describe("summarizeChangedPaths()", () => {
  it("returns '<none>' for empty array", () => {
    expect(summarizeChangedPaths([])).toBe("<none>");
  });

  it("returns joined paths within limit", () => {
    const paths = ["a.ts", "b.ts", "c.ts"];
    const result = summarizeChangedPaths(paths);
    expect(result).toContain("a.ts");
    expect(result).toContain("b.ts");
  });

  it("truncates with '+N more' when exceeding maxPaths", () => {
    const paths = Array.from({ length: 12 }, (_, i) => `file${i}.ts`);
    const result = summarizeChangedPaths(paths, 8);
    expect(result).toContain("+4 more");
  });

  it("respects custom maxPaths", () => {
    const paths = ["a.ts", "b.ts", "c.ts"];
    const result = summarizeChangedPaths(paths, 2);
    expect(result).toContain("+1 more");
  });

  it("shows all paths when exactly at limit", () => {
    const paths = ["x.ts", "y.ts"];
    const result = summarizeChangedPaths(paths, 2);
    expect(result).not.toContain("more");
  });
});
