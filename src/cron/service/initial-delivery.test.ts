/**
 * src/cron/service/initial-delivery.test.ts
 *
 * CoreBlow — Cron Service Initial Delivery Tests
 * Verifies resolveInitialCronDelivery delivery resolution logic
 * and normalizeCronCreateDeliveryInput idempotency.
 */
import { describe, expect, it } from "vitest";
import {
  normalizeCronCreateDeliveryInput,
  resolveInitialCronDelivery,
} from "./initial-delivery.js";
import type { CronJobCreate } from "../types.js";

function makeCreate(overrides: Partial<CronJobCreate> = {}): CronJobCreate {
  return {
    payload: { type: "prompt", prompt: "test" },
    sessionTarget: { type: "channel", channelId: "discord:123" },
    schedule: { kind: "every", everyMs: 60_000 },
    ...overrides,
  } as unknown as CronJobCreate;
}

describe("resolveInitialCronDelivery", () => {
  it("returns existing delivery when set", () => {
    const delivery = { mode: "announce" } as never;
    const result = resolveInitialCronDelivery(makeCreate({ delivery }));
    expect(result).toEqual(delivery);
  });

  it("returns undefined when sessionTarget is channel (not isolated)", () => {
    const result = resolveInitialCronDelivery(makeCreate());
    expect(result).toBeUndefined();
  });

  it("returns announce delivery for isolated + agentTurn", () => {
    const result = resolveInitialCronDelivery(
      makeCreate({
        sessionTarget: "isolated",
        payload: { kind: "agentTurn" } as never,
      }),
    );
    expect(result).toEqual({ mode: "announce" });
  });

  it("returns undefined for isolated + non-agentTurn payload", () => {
    const result = resolveInitialCronDelivery(
      makeCreate({
        sessionTarget: "isolated",
        payload: { type: "prompt", prompt: "test" } as never,
      }),
    );
    expect(result).toBeUndefined();
  });
});

describe("normalizeCronCreateDeliveryInput", () => {
  it("returns same reference when no normalization needed", () => {
    const input = makeCreate();
    const result = normalizeCronCreateDeliveryInput(input);
    expect(result).toBe(input);
  });

  it("does not throw for any valid input", () => {
    expect(() => normalizeCronCreateDeliveryInput(makeCreate())).not.toThrow();
  });

  it("returns a CronJobCreate object", () => {
    const result = normalizeCronCreateDeliveryInput(makeCreate());
    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("payload");
  });
});
