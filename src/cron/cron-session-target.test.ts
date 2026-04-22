import { describe, expect, it } from "vitest";
import type { CronSessionTarget } from "./types.js";

describe("CronSessionTarget variants", () => {
  it("main is valid", () => {
    const t: CronSessionTarget = "main";
    expect(t).toBe("main");
  });

  it("isolated is valid", () => {
    const t: CronSessionTarget = "isolated";
    expect(t).toBe("isolated");
  });

  it("current is valid", () => {
    const t: CronSessionTarget = "current";
    expect(t).toBe("current");
  });

  it("session: prefix template is valid", () => {
    const t: CronSessionTarget = "session:my-session";
    expect(t.startsWith("session:")).toBe(true);
  });

  it("session: prefix can hold any suffix", () => {
    const targets: CronSessionTarget[] = [
      "session:abc",
      "session:123",
      "session:user-thread",
    ];
    for (const t of targets) {
      expect(t.startsWith("session:")).toBe(true);
    }
  });

  it("all non-template variants are non-empty strings", () => {
    const variants: CronSessionTarget[] = ["main", "isolated", "current"];
    for (const v of variants) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    }
  });
});
