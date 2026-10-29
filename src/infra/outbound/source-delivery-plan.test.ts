import { describe, expect, it } from "vitest";
import {
  createSourceDeliveryPlan,
  resolveSourceDeliveryOutcome,
  sourceDeliveryTargetsMatch,
} from "./source-delivery-plan.js";

describe("source delivery plan", () => {
  it("derives message-tool ownership defaults from the source plan", () => {
    const contract = createSourceDeliveryPlan({
      owner: "message_tool_then_direct_fallback",
      reason: "cron_announce",
      target: { channel: "slack", to: "channel:C1", accountId: "default" },
    });

    expect(contract.normalFinal).toBe("private");
    expect(contract.sourceReplyDeliveryMode).toBe("message_tool_only");
    expect(contract.messageTool.enabled).toBe(true);
    expect(contract.messageTool.force).toBe(true);
    expect(contract.fallback.directDelivery).toBe(true);
    expect(contract.fallback.skipWhenMessageToolSentToTarget).toBe(true);
  });

  it("suppresses fallback delivery when message tool sent to matching target", () => {
    const contract = createSourceDeliveryPlan({
      owner: "message_tool_then_direct_fallback",
      reason: "cron_announce",
      target: { channel: "slack", to: "channel:C1" },
    });

    const outcome = resolveSourceDeliveryOutcome(contract, {
      didSendViaMessageTool: true,
      messageToolSentTargets: [{ tool: "message", provider: "slack", to: "channel:C1" }],
    });

    expect(outcome.satisfiesSourceDelivery).toBe(true);
    expect(outcome.verifiedMessageToolDelivery).toBe(true);
    expect(outcome.unverifiedMessageToolDelivery).toBe(false);
    expect(outcome.visibleDeliveries[0]?.verifiedTarget).toBe(true);
  });

  it("does not suppress fallback delivery when message tool sent to another target", () => {
    const contract = createSourceDeliveryPlan({
      owner: "message_tool_then_direct_fallback",
      reason: "cron_announce",
      target: { channel: "slack", to: "channel:C1" },
    });

    const outcome = resolveSourceDeliveryOutcome(contract, {
      didSendViaMessageTool: true,
      messageToolSentTargets: [{ tool: "message", provider: "slack", to: "channel:C2" }],
    });

    expect(outcome.satisfiesSourceDelivery).toBe(false);
    expect(outcome.verifiedMessageToolDelivery).toBe(false);
    expect(outcome.unverifiedMessageToolDelivery).toBe(true);
    expect(outcome.visibleDeliveries[0]?.verifiedTarget).toBe(false);
  });

  it("keeps verified message-tool delivery separate from source fallback satisfaction", () => {
    const contract = createSourceDeliveryPlan({
      owner: "none",
      reason: "cron_none",
      target: { channel: "slack", to: "channel:C1" },
      messageToolEnabled: true,
      messageToolForced: true,
      directFallback: false,
    });

    const outcome = resolveSourceDeliveryOutcome(contract, {
      didSendViaMessageTool: true,
      messageToolSentTargets: [{ tool: "message", provider: "slack", to: "channel:C1" }],
    });

    expect(outcome.verifiedMessageToolDelivery).toBe(true);
    expect(outcome.satisfiesSourceDelivery).toBe(false);
    expect(outcome.unverifiedMessageToolDelivery).toBe(false);
  });

  it("does not satisfy delivery from target metadata without a committed message-tool send", () => {
    const contract = createSourceDeliveryPlan({
      owner: "message_tool_then_direct_fallback",
      reason: "cron_announce",
      target: { channel: "slack", to: "channel:C1" },
    });

    const outcome = resolveSourceDeliveryOutcome(contract, {
      didSendViaMessageTool: false,
      messageToolSentTargets: [{ tool: "message", provider: "slack", to: "channel:C1" }],
    });

    expect(outcome.visibleDeliveries[0]?.verifiedTarget).toBe(true);
    expect(outcome.verifiedMessageToolDelivery).toBe(false);
    expect(outcome.satisfiesSourceDelivery).toBe(false);
    expect(outcome.unverifiedMessageToolDelivery).toBe(false);
  });

  it("does not synthesize an implicit target without a concrete recipient", () => {
    const contract = createSourceDeliveryPlan({
      owner: "direct_fallback",
      reason: "cron_announce",
      target: { channel: "slack" },
      messageToolEnabled: true,
      messageToolForced: true,
      directFallback: true,
      skipFallbackWhenMessageToolSentToTarget: false,
    });

    const outcome = resolveSourceDeliveryOutcome(contract, {
      didSendViaMessageTool: true,
    });

    expect(outcome.visibleDeliveries).toEqual([]);
    expect(outcome.verifiedMessageToolDelivery).toBe(false);
    expect(outcome.satisfiesSourceDelivery).toBe(false);
    expect(outcome.unverifiedMessageToolDelivery).toBe(false);
  });

  it("matches source targets through the same provider normalization used by delivery", () => {
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "message", to: "channel:C1" },
        { channel: "slack", to: "channel:C1" },
      ),
    ).toBe(true);
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "discord", to: "channel:C1" },
        { channel: "slack", to: "channel:C1" },
      ),
    ).toBe(false);
  });

  it("matches same-kind delivery target prefixes without normalizing provider-owned IDs", () => {
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "slack", to: "Channel: C1" },
        { channel: "slack", to: "channel:C1" },
      ),
    ).toBe(true);
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "slack", to: "channel:C2" },
        { channel: "slack", to: "channel:C1" },
      ),
    ).toBe(false);
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "slack", to: "channel:c1" },
        { channel: "slack", to: "channel:C1" },
      ),
    ).toBe(true);
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "mattermost", to: "channel: abc" },
        { channel: "mattermost", to: "channel:ABC" },
      ),
    ).toBe(false);
  });

  it("matches threaded delivery only with explicit or supported implicit thread evidence", () => {
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "telegram", to: "-100:topic:462" },
        { channel: "telegram", to: "-100", threadId: 462 },
      ),
    ).toBe(true);
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "telegram", to: "-100" },
        { channel: "telegram", to: "-100", threadId: 462 },
      ),
    ).toBe(false);
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "telegram", to: "-100", threadImplicit: true },
        { channel: "telegram", to: "-100", threadId: 462 },
      ),
    ).toBe(true);
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "telegram", to: "-100", threadImplicit: true, threadSuppressed: true },
        { channel: "telegram", to: "-100", threadId: 462 },
      ),
    ).toBe(false);
    expect(
      sourceDeliveryTargetsMatch(
        { provider: "telegram", to: "-100", threadId: "111" },
        { channel: "telegram", to: "-100", threadId: 462 },
      ),
    ).toBe(false);
  });
});
