import { describe, expect, it } from "vitest";
import {
  createChatEvent,
  createPendingPromptHarness,
  DEFAULT_SESSION_KEY,
} from "./translator.prompt-harness.test-support.js";

describe("ACP translator errorKind mapping", () => {
  it("maps explicit refusals without misclassifying transient errors", async () => {
    const refusal = await createPendingPromptHarness();
    await refusal.agent.handleGatewayEvent(createChatEvent({
      runId: refusal.runId,
      sessionKey: DEFAULT_SESSION_KEY,
      state: "error",
      errorKind: "refusal",
    }));
    await expect(refusal.promptPromise).resolves.toEqual({ stopReason: "refusal" });

    const timeout = await createPendingPromptHarness();
    await timeout.agent.handleGatewayEvent(createChatEvent({
      runId: timeout.runId,
      sessionKey: DEFAULT_SESSION_KEY,
      state: "error",
      errorKind: "timeout",
    }));
    await expect(timeout.promptPromise).resolves.toEqual({ stopReason: "end_turn" });
  });
});
