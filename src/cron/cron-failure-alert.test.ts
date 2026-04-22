import { describe, expect, it } from "vitest";
import type { CronFailureAlert, CronFailureDestination } from "./types.js";

describe("CronFailureDestination shape", () => {
  it("can be constructed with channel and to", () => {
    const dest: CronFailureDestination = {
      channel: "telegram",
      to: "user-123",
    };
    expect(dest.channel).toBe("telegram");
  });

  it("to field is accessible", () => {
    const dest: CronFailureDestination = {
      channel: "discord",
      to: "@admin",
    };
    expect(dest.to).toBe("@admin");
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

  it("accepts channel and to fields", () => {
    const alert: Partial<CronFailureAlert> = {
      channel: "telegram" as any,
      to: "admin",
    };
    expect(alert).toBeDefined();
  });

  it("to field is a string when set", () => {
    const alert: Partial<CronFailureAlert> = {
      to: "ops-channel",
    };
    expect(typeof alert.to).toBe("string");
  });

  it("an empty failure alert is valid", () => {
    const alert: Partial<CronFailureAlert> = {};
    expect(Object.keys(alert).length).toBe(0);
  });
});
