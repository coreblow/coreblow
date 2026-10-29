import { describe, expect, it } from "vitest";
import {
  normalizeCronSessionTargetOption,
  parseCronThreadIdOption,
} from "./thread-id-shared.js";

describe("thread-id-shared", () => {
  it("parses valid positive integer thread ids", () => {
    expect(parseCronThreadIdOption("123")).toBe(123);
    expect(parseCronThreadIdOption("1")).toBe(1);
    expect(parseCronThreadIdOption("456")).toBe(456);
    expect(parseCronThreadIdOption(undefined)).toBeUndefined();
    expect(parseCronThreadIdOption("")).toBeUndefined();
  });

  it("throws on invalid thread ids", () => {
    expect(() => parseCronThreadIdOption("abc")).toThrow("--thread-id must be a positive integer");
    expect(() => parseCronThreadIdOption("-5")).toThrow("--thread-id must be a positive integer");
    expect(() => parseCronThreadIdOption("0")).toThrow("--thread-id must be a safe positive integer");
  });

  it("normalizes session target options", () => {
    expect(normalizeCronSessionTargetOption("main")).toBe("main");
    expect(normalizeCronSessionTargetOption("MAIN")).toBe("main");
    expect(normalizeCronSessionTargetOption("isolated")).toBe("isolated");
    expect(normalizeCronSessionTargetOption("current")).toBe("current");
    expect(normalizeCronSessionTargetOption("session:abc-123")).toBe("session:abc-123");
    expect(normalizeCronSessionTargetOption("other")).toBeUndefined();
    expect(normalizeCronSessionTargetOption("")).toBeUndefined();
    expect(normalizeCronSessionTargetOption(undefined)).toBeUndefined();
  });
});
