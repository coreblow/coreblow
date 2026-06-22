import { describe, expect, it, vi } from "vitest";
import type { VoiceCallRealtimeFastContextConfig } from "./config.js";
import { resolveRealtimeFastContextConsult } from "./realtime-fast-context.js";

function createFastContextConfig(
  overrides: Partial<VoiceCallRealtimeFastContextConfig> = {},
): VoiceCallRealtimeFastContextConfig {
  return {
    enabled: true,
    timeoutMs: 800,
    maxResults: 3,
    sources: ["memory", "sessions"],
    fallbackToConsult: false,
    ...overrides,
  };
}

describe("resolveRealtimeFastContextConsult", () => {
  it("returns handled=false when the local CoreBlow fast context runtime is unavailable", async () => {
    const logger = {
      debug: vi.fn(),
    };

    await expect(
      resolveRealtimeFastContextConsult({
        cfg: {},
        agentId: "main",
        sessionKey: "voice:15550001234",
        config: createFastContextConfig({ fallbackToConsult: true }),
        args: { question: "What do you remember?" },
        logger,
      }),
    ).resolves.toEqual({ handled: false });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("fast context unavailable"),
    );
  });
});
