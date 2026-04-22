import { describe, expect, it } from "vitest";
import type {
  CronDeliveryStatus,
  CronRunOutcome,
  CronUsageSummary,
} from "./types.js";

describe("CronDeliveryStatus type", () => {
  it("delivered is valid", () => {
    const s: CronDeliveryStatus = "delivered";
    expect(s).toBe("delivered");
  });

  it("not-delivered is valid", () => {
    const s: CronDeliveryStatus = "not-delivered";
    expect(s).toBe("not-delivered");
  });

  it("unknown is valid", () => {
    const s: CronDeliveryStatus = "unknown";
    expect(s).toBe("unknown");
  });

  it("not-requested is valid", () => {
    const s: CronDeliveryStatus = "not-requested";
    expect(s).toBe("not-requested");
  });
});

describe("CronUsageSummary shape", () => {
  it("can be constructed as an object", () => {
    const usage: Partial<CronUsageSummary> = {};
    expect(typeof usage).toBe("object");
  });
});

describe("CronRunOutcome shape", () => {
  it("can reference status field", () => {
    const outcome: Partial<CronRunOutcome> = { status: "ok" };
    expect(outcome.status).toBe("ok");
  });

  it("status error is assignable", () => {
    const outcome: Partial<CronRunOutcome> = { status: "error" };
    expect(outcome.status).toBe("error");
  });

  it("status skipped is assignable", () => {
    const outcome: Partial<CronRunOutcome> = { status: "skipped" };
    expect(outcome.status).toBe("skipped");
  });
});
