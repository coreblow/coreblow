import { describe, expect, it, vi } from "vitest";

const deliverOutboundPayloads = vi.hoisted(() => vi.fn());

vi.mock("../../infra/outbound/deliver.js", () => ({
  deliverOutboundPayloads,
}));

import {
  sendDurableMessageBatch,
  type DurableMessageBatchSendResult,
  withDurableMessageSendContext,
} from "./send.js";

type DeliveryRequest = {
  abortSignal?: AbortSignal;
  payloads?: unknown;
  bestEffort?: boolean;
  replyToId?: string;
  threadId?: string | number;
  onDeliveryIntent?: (intent: {
    id: string;
    channel: string;
    to: string;
    queuePolicy: "required" | "best_effort";
  }) => void;
  onPayloadDeliveryOutcome?: (outcome: {
    index: number;
    status: "suppressed" | "failed" | "sent";
    reason?: string;
    error?: unknown;
    sentBeforeError?: boolean;
    stage?: "platform_send";
    results?: unknown[];
  }) => void;
};

const cfg = {};

function latestDeliveryRequest(): DeliveryRequest {
  const [request] = deliverOutboundPayloads.mock.calls.at(-1) ?? [];
  if (!request) {
    throw new Error("expected delivery request");
  }
  return request as DeliveryRequest;
}

function expectBatchStatus<TStatus extends DurableMessageBatchSendResult["status"]>(
  result: DurableMessageBatchSendResult,
  status: TStatus,
): asserts result is Extract<DurableMessageBatchSendResult, { status: TStatus }> {
  expect(result.status).toBe(status);
  if (result.status !== status) {
    throw new Error(`expected durable batch status ${status}`);
  }
}

describe("withDurableMessageSendContext", () => {
  it("renders and sends through a durable send context", async () => {
    deliverOutboundPayloads.mockImplementationOnce(async (params: DeliveryRequest) => {
      params.onDeliveryIntent?.({
        id: "intent-1",
        channel: "telegram",
        to: "chat-1",
        queuePolicy: "required",
      });
      return [{ channel: "telegram", messageId: "msg-1" }];
    });

    const result = await withDurableMessageSendContext(
      {
        cfg,
        channel: "telegram",
        to: "chat-1",
        payloads: [{ text: "hello" }],
        threadId: 42,
        replyToId: "reply-1",
      },
      async (ctx) => {
        const rendered = await ctx.render();
        expect(rendered.plan.items[0]).toMatchObject({ kinds: ["text"], text: "hello" });
        const send = await ctx.send(rendered);
        expect(ctx.intent?.id).toBe("intent-1");
        expect(ctx.intent?.renderedBatch).toBe(rendered);
        return send;
      },
    );

    expectBatchStatus(result, "sent");
    expect(result.deliveryIntent?.id).toBe("intent-1");
    expect(result.receipt.platformMessageIds).toEqual(["msg-1"]);
    expect(result.receipt.threadId).toBe("42");
    expect(result.receipt.replyToId).toBe("reply-1");
    const request = latestDeliveryRequest();
    expect(request.bestEffort).toBeUndefined();
    expect(request.payloads).toEqual([{ text: "hello" }]);
    expect(request.threadId).toBe(42);
    expect(request.replyToId).toBe("reply-1");
  });

  it("maps best-effort durability to best-effort delivery", async () => {
    deliverOutboundPayloads.mockImplementationOnce(async (params: DeliveryRequest) => {
      params.onDeliveryIntent?.({
        id: "intent-best-effort",
        channel: "telegram",
        to: "chat-1",
        queuePolicy: "best_effort",
      });
      return [{ channel: "telegram", messageId: "msg-1" }];
    });

    const result = await sendDurableMessageBatch({
      cfg,
      channel: "telegram",
      to: "chat-1",
      payloads: [{ text: "hello" }],
      durability: "best_effort",
    });

    expectBatchStatus(result, "sent");
    expect(result.deliveryIntent?.id).toBe("intent-best-effort");
    expect(latestDeliveryRequest().bestEffort).toBe(true);
  });

  it("treats no visible outbound result as a committed suppressed send", async () => {
    deliverOutboundPayloads.mockImplementationOnce(async (params: DeliveryRequest) => {
      params.onDeliveryIntent?.({
        id: "intent-2",
        channel: "whatsapp",
        to: "jid-1",
        queuePolicy: "required",
      });
      return [];
    });
    const onCommitReceipt = vi.fn();

    const result = await sendDurableMessageBatch({
      cfg,
      channel: "whatsapp",
      to: "jid-1",
      payloads: [{ text: "hidden" }],
      onCommitReceipt,
    });

    expectBatchStatus(result, "suppressed");
    expect(result.reason).toBe("no_visible_result");
    expect(result.deliveryIntent?.id).toBe("intent-2");
    expect(onCommitReceipt).toHaveBeenCalledTimes(1);
  });

  it("reports hook-cancelled deliveries as explicit suppressed sends", async () => {
    deliverOutboundPayloads.mockImplementationOnce(async (params: DeliveryRequest) => {
      params.onPayloadDeliveryOutcome?.({
        index: 0,
        status: "suppressed",
        reason: "cancelled_by_message_sending_hook",
      });
      return [];
    });

    const result = await sendDurableMessageBatch({
      cfg,
      channel: "slack",
      to: "C123",
      payloads: [{ text: "claimed elsewhere" }],
    });

    expectBatchStatus(result, "suppressed");
    expect(result.reason).toBe("cancelled_by_message_sending_hook");
    expect(result.payloadOutcomes?.[0]).toEqual({
      index: 0,
      status: "suppressed",
      reason: "cancelled_by_message_sending_hook",
    });
  });

  it("runs the failure hook when durable outbound delivery fails", async () => {
    const error = new Error("send failed");
    deliverOutboundPayloads.mockRejectedValueOnce(error);
    const onSendFailure = vi.fn();

    const result = await sendDurableMessageBatch({
      cfg,
      channel: "telegram",
      to: "chat-1",
      payloads: [{ text: "hello" }],
      onSendFailure,
    });

    expect(result).toEqual({ status: "failed", error });
    expect(onSendFailure).toHaveBeenCalledWith(error);
  });
});
