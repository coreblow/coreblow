import { describe, expect, it } from "vitest";
import type {
  CronDelivery,
  CronDeliveryMode,
  CronRunStatus,
  CronSessionTarget,
  CronWakeMode,
} from "./types.js";

describe("CronRunStatus type", () => {
  it("ok is a valid status", () => {
    const s: CronRunStatus = "ok";
    expect(s).toBe("ok");
  });

  it("error is a valid status", () => {
    const s: CronRunStatus = "error";
    expect(s).toBe("error");
  });

  it("skipped is a valid status", () => {
    const s: CronRunStatus = "skipped";
    expect(s).toBe("skipped");
  });
});

describe("CronWakeMode type", () => {
  it("now is a valid wake mode", () => {
    const m: CronWakeMode = "now";
    expect(m).toBe("now");
  });

  it("next-heartbeat is a valid wake mode", () => {
    const m: CronWakeMode = "next-heartbeat";
    expect(m).toBe("next-heartbeat");
  });
});

describe("CronSessionTarget type", () => {
  it("main is a valid session target", () => {
    const t: CronSessionTarget = "main";
    expect(t).toBe("main");
  });

  it("isolated is a valid session target", () => {
    const t: CronSessionTarget = "isolated";
    expect(t).toBe("isolated");
  });

  it("current is a valid session target", () => {
    const t: CronSessionTarget = "current";
    expect(t).toBe("current");
  });
});

describe("CronDeliveryMode type", () => {
  it("none is a valid delivery mode", () => {
    const m: CronDeliveryMode = "none";
    expect(m).toBe("none");
  });

  it("announce is a valid delivery mode", () => {
    const m: CronDeliveryMode = "announce";
    expect(m).toBe("announce");
  });

  it("webhook is a valid delivery mode", () => {
    const m: CronDeliveryMode = "webhook";
    expect(m).toBe("webhook");
  });
});

describe("CronDelivery object shape", () => {
  it("can construct a valid CronDelivery", () => {
    const d: CronDelivery = { mode: "announce" };
    expect(d.mode).toBe("announce");
  });

  it("mode property is accessible", () => {
    const d: CronDelivery = { mode: "none" };
    expect("mode" in d).toBe(true);
  });
});
