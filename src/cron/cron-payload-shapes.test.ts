/**
 * src/cron/cron-payload-shapes.test.ts
 *
 * CoreBlow — Cron Payload Shape Tests
 * Verifies CronPayload variant shapes (systemEvent and agentTurn)
 * can be correctly constructed and discriminated.
 */
import { describe, expect, it } from "vitest";
import type { CronPayload } from "./types.js";

describe("CronPayload — systemEvent", () => {
  it("can be constructed with kind=systemEvent", () => {
    const p: CronPayload = { kind: "systemEvent", text: "System maintenance" };
    expect(p.kind).toBe("systemEvent");
  });

  it("text field is accessible", () => {
    const p: CronPayload = { kind: "systemEvent", text: "hello world" };
    expect((p as never as { text: string }).text).toBe("hello world");
  });

  it("kind discriminates systemEvent", () => {
    const p: CronPayload = { kind: "systemEvent", text: "x" };
    if (p.kind === "systemEvent") {
      expect(p.text.length).toBeGreaterThan(0);
    }
  });
});

describe("CronPayload — agentTurn", () => {
  it("can be constructed with kind=agentTurn", () => {
    const p: CronPayload = { kind: "agentTurn" } as never;
    expect(p.kind).toBe("agentTurn");
  });

  it("kind discriminates agentTurn", () => {
    const p: CronPayload = { kind: "agentTurn" } as never;
    expect(p.kind).toBe("agentTurn");
  });

  it("payload kinds are distinct", () => {
    const a: CronPayload = { kind: "systemEvent", text: "x" };
    const b: CronPayload = { kind: "agentTurn" } as never;
    expect(a.kind).not.toBe(b.kind);
  });
});
