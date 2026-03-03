/**
 * extensions/telegram/src/reaction-level.test.ts
 *
 * CoreBlow — Telegram Extension: Reaction-level Tests
 * Verifies Reaction level parsing and normalization.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveTelegramReactionLevel } from "./reaction-level.js";

describe("resolveTelegramReactionLevel", () => {
  const prevToken = process.env.TELEGRAM_BOT_TOKEN;

  beforeAll(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
  });

  afterAll(() => {
    if (prevToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = prevToken;
    }
  });

  it("defaults to minimal when reactionLevel is not set", () => {
    const cfg = { channels: { telegram: {} } } as any;
    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("minimal");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(true);
    expect(result.agentReactionGuidance).toBe("minimal");
  });

  it("resolves 'off' correctly", () => {
    const cfg = { channels: { telegram: { reactionLevel: "off" } } } as any;
    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("off");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(false);
  });

  it("resolves 'ack' correctly", () => {
    const cfg = { channels: { telegram: { reactionLevel: "ack" } } } as any;
    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("ack");
    expect(result.ackEnabled).toBe(true);
    expect(result.agentReactionsEnabled).toBe(false);
  });

  it("resolves 'minimal' correctly", () => {
    const cfg = { channels: { telegram: { reactionLevel: "minimal" } } } as any;
    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("minimal");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(true);
    expect(result.agentReactionGuidance).toBe("minimal");
  });

  it("resolves 'extensive' correctly", () => {
    const cfg = { channels: { telegram: { reactionLevel: "extensive" } } } as any;
    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("extensive");
    expect(result.ackEnabled).toBe(false);
    expect(result.agentReactionsEnabled).toBe(true);
    expect(result.agentReactionGuidance).toBe("extensive");
  });

  it("resolves reaction level from a specific account", () => {
    const cfg = {
      channels: {
        telegram: {
          reactionLevel: "ack",
          accounts: {
            work: { botToken: "tok-work", reactionLevel: "extensive" },
          },
        },
      },
    } as any;
    const result = resolveTelegramReactionLevel({ cfg, accountId: "work" });
    expect(result.level).toBe("extensive");
  });

  it("falls back to global level when account has no reactionLevel", () => {
    const cfg = {
      channels: {
        telegram: {
          reactionLevel: "minimal",
          accounts: {
            work: { botToken: "tok-work" },
          },
        },
      },
    } as any;
    const result = resolveTelegramReactionLevel({ cfg, accountId: "work" });
    expect(result.level).toBe("minimal");
  });

  it("falls back to ack for invalid values", () => {
    const cfg = { channels: { telegram: { reactionLevel: "invalid-value" } } } as any;
    const result = resolveTelegramReactionLevel({ cfg });
    expect(result.level).toBe("ack");
  });
});
