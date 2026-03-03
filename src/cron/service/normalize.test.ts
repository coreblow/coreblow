import { describe, it, expect } from "vitest";
import {
  normalizeRequiredName,
  normalizeOptionalText,
  normalizeOptionalAgentId,
  normalizeOptionalSessionKey,
  inferLegacyName,
  normalizePayloadToSystemText,
} from "./normalize.js";

describe("normalizeRequiredName", () => {
  it("returns trimmed name for valid strings", () => {
    expect(normalizeRequiredName("  My Job  ")).toBe("My Job");
    expect(normalizeRequiredName("simple")).toBe("simple");
  });

  it("throws for empty or whitespace-only strings", () => {
    expect(() => normalizeRequiredName("")).toThrow("cron job name is required");
    expect(() => normalizeRequiredName("   ")).toThrow("cron job name is required");
  });

  it("throws for non-string values", () => {
    expect(() => normalizeRequiredName(null)).toThrow("cron job name is required");
    expect(() => normalizeRequiredName(undefined)).toThrow("cron job name is required");
    expect(() => normalizeRequiredName(42)).toThrow("cron job name is required");
  });
});

describe("normalizeOptionalText", () => {
  it("returns trimmed text for non-empty strings", () => {
    expect(normalizeOptionalText("  hello  ")).toBe("hello");
  });

  it("returns undefined for empty strings", () => {
    expect(normalizeOptionalText("")).toBeUndefined();
    expect(normalizeOptionalText("   ")).toBeUndefined();
  });

  it("returns undefined for non-string values", () => {
    expect(normalizeOptionalText(null)).toBeUndefined();
    expect(normalizeOptionalText(undefined)).toBeUndefined();
    expect(normalizeOptionalText(42)).toBeUndefined();
  });
});

describe("normalizeOptionalAgentId", () => {
  it("returns normalized agent id for valid strings", () => {
    const result = normalizeOptionalAgentId("  My-Agent  ");
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it("returns undefined for empty/non-string values", () => {
    expect(normalizeOptionalAgentId("")).toBeUndefined();
    expect(normalizeOptionalAgentId("   ")).toBeUndefined();
    expect(normalizeOptionalAgentId(null)).toBeUndefined();
    expect(normalizeOptionalAgentId(42)).toBeUndefined();
  });
});

describe("normalizeOptionalSessionKey", () => {
  it("returns trimmed key for non-empty strings", () => {
    expect(normalizeOptionalSessionKey("  main  ")).toBe("main");
  });

  it("returns undefined for empty/non-string values", () => {
    expect(normalizeOptionalSessionKey("")).toBeUndefined();
    expect(normalizeOptionalSessionKey(null)).toBeUndefined();
    expect(normalizeOptionalSessionKey(42)).toBeUndefined();
  });
});

describe("inferLegacyName", () => {
  it("infers name from systemEvent text", () => {
    const result = inferLegacyName({
      payload: { kind: "systemEvent", text: "Daily cleanup\nsecond line" },
    });
    expect(result).toBe("Daily cleanup");
  });

  it("infers name from agentTurn message", () => {
    const result = inferLegacyName({
      payload: { kind: "agentTurn", message: "Check weather" },
    });
    expect(result).toBe("Check weather");
  });

  it("infers name from cron expression", () => {
    const result = inferLegacyName({
      schedule: { kind: "cron", expr: "0 * * * *" },
      payload: {},
    });
    expect(result).toBe("Cron: 0 * * * *");
  });

  it("infers name from every schedule", () => {
    const result = inferLegacyName({
      schedule: { kind: "every", everyMs: 60000 },
      payload: {},
    });
    expect(result).toBe("Every: 60000ms");
  });

  it("returns 'One-shot' for at schedules without text", () => {
    const result = inferLegacyName({
      schedule: { kind: "at" },
      payload: {},
    });
    expect(result).toBe("One-shot");
  });

  it("returns default 'Cron job' when nothing matches", () => {
    const result = inferLegacyName({ payload: {} });
    expect(result).toBe("Cron job");
  });

  it("truncates long text", () => {
    const longText = "A".repeat(100);
    const result = inferLegacyName({
      payload: { kind: "systemEvent", text: longText },
    });
    expect(result.length).toBeLessThanOrEqual(60);
  });
});

describe("normalizePayloadToSystemText", () => {
  it("extracts text from systemEvent payload", () => {
    const result = normalizePayloadToSystemText({ kind: "systemEvent", text: "  hello  " } as any);
    expect(result).toBe("hello");
  });

  it("extracts message from agentTurn payload", () => {
    const result = normalizePayloadToSystemText({ kind: "agentTurn", message: "  world  " } as any);
    expect(result).toBe("world");
  });
});
