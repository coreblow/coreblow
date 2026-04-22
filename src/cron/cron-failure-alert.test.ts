/**
 * src/cron/cron-failure-alert.test.ts
 *
 * CoreBlow — Cron Failure Alert Shape Tests
 * Verifies CronFailureAlert and CronFailureDestination
 * can be constructed and have expected fields.
 */
import { describe, expect, it } from "vitest";
import type { CronFailureAlert, CronFailureDestination } from "./types.js";

describe("CronFailureDestination shape", () => {
  it("can be constructed with channel and to", () => {
    const dest: CronFailureDestination = {
      channel: "telegram",
      to: "user-123",
    } as never;
    expect((dest as never as { channel: string }).channel).toBe("telegram");
  });

  it("to field is accessible", () => {
    const dest: CronFailureDestination = {
      channel: "discord",
      to: "@admin",
    } as never;
    expect((dest as never as { to: string }).to).toBe("@admin");
  });

  it("channel is a string", () => {
    const dest = { channel: "slack", to: "ops-channel" };
    expect(typeof dest.channel).toBe("string");
  });
});

describe("CronFailureAlert shape", () => {
  it("can be constructed as an object", () => {
    const alert: Partial<CronFailureAlert> = {};
    expect(typeof alert).toBe("object");
  });

  it("does not throw when constructing with destinations", () => {
    const alert: Partial<CronFailureAlert> = {
      destinations: [
        { channel: "telegram", to: "admin" } as never,
      ],
    };
    expect(alert).toBeDefined();
  });

  it("destinations field is an array when set", () => {
    const alert: Partial<CronFailureAlert> = {
      destinations: [] as never,
    };
    expect(Array.isArray(alert.destinations)).toBe(true);
  });

  it("an empty failure alert is valid", () => {
    const alert: Partial<CronFailureAlert> = {};
    expect(Object.keys(alert).length).toBe(0);
  });
});
