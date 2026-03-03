import { describe, it, expect } from "vitest";
import { migrateLegacyCronPayload } from "./payload-migration.js";

describe("migrateLegacyCronPayload", () => {
  it("normalizes channel to lowercase trimmed", () => {
    const payload: Record<string, unknown> = { channel: "  Discord  " };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.channel).toBe("discord");
  });

  it("removes provider field", () => {
    const payload: Record<string, unknown> = { provider: "slack", channel: "slack" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.provider).toBeUndefined();
    expect(payload.channel).toBe("slack");
  });

  it("uses provider as fallback when channel is empty", () => {
    const payload: Record<string, unknown> = { provider: "Telegram", channel: "" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.channel).toBe("telegram");
    expect(payload.provider).toBeUndefined();
  });

  it("uses provider as fallback when channel is missing", () => {
    const payload: Record<string, unknown> = { provider: "Matrix" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(true);
    expect(payload.channel).toBe("matrix");
    expect(payload.provider).toBeUndefined();
  });

  it("returns false when nothing to migrate", () => {
    const payload: Record<string, unknown> = { channel: "discord" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(false);
    expect(payload.channel).toBe("discord");
  });

  it("handles non-string channel/provider values", () => {
    const payload: Record<string, unknown> = { channel: 123, provider: null };
    const mutated = migrateLegacyCronPayload(payload);
    // provider key exists but is deleted
    expect(payload.provider).toBeUndefined();
  });

  it("handles both channel and provider absent", () => {
    const payload: Record<string, unknown> = { name: "test-job" };
    const mutated = migrateLegacyCronPayload(payload);
    expect(mutated).toBe(false);
  });
});
