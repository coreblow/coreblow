import { describe, expect, it, vi } from "vitest";
import { telegramApprovalNativeRuntime } from "./approval-handler.runtime.js";

type TelegramPayload = {
  text: string;
  buttons?: Array<Array<{ text: string }>>;
};

describe("telegramApprovalNativeRuntime", () => {
  it("renders only the allowed pending buttons", async () => {
    const payload = (await telegramApprovalNativeRuntime.presentation.buildPendingPayload({
      cfg: {} as never,
      accountId: "default",
      context: {
        token: "tg-token",
      },
      request: {
        id: "req-1",
        request: {
          command: "echo hi",
        },
        createdAtMs: 0,
        expiresAtMs: 60_000,
      },
      approvalKind: "exec",
      nowMs: 0,
      view: {
        approvalKind: "exec",
        approvalId: "req-1",
        commandText: "echo hi",
        actions: [
          {
            decision: "allow-once",
            label: "Allow Once",
            command: "/approve req-1 allow-once",
            style: "success",
          },
          {
            decision: "deny",
            label: "Deny",
            command: "/approve req-1 deny",
            style: "danger",
          },
        ],
      } as never,
    })) as TelegramPayload;

    expect(payload.text).toContain("/approve req-1 allow-once");
    expect(payload.text).not.toContain("allow-always");
    expect(payload.buttons?.[0]?.map((button) => button.text)).toEqual(["Allow Once", "Deny"]);
  });

  it("sends typing indicator and message via deps", async () => {
    const sendTyping = vi.fn().mockResolvedValue({});
    const sendMessage = vi.fn().mockResolvedValue({ chatId: "chat-123", messageId: "msg-456" });

    const result = await (telegramApprovalNativeRuntime.transport as any).deliverPending({
      cfg: {} as never,
      accountId: "default",
      context: {
        token: "tg-token",
        deps: {
          sendTyping,
          sendMessage,
        },
      },
      preparedTarget: {
        chatId: "chat-123",
        messageThreadId: 42,
      },
      pendingPayload: {
        text: "Approval requested",
        buttons: [[{ text: "Approve", callback_data: "/approve req-1 allow-once" }]],
      },
    });

    expect(sendTyping).toHaveBeenCalledWith("chat-123", expect.objectContaining({
      token: "tg-token",
      accountId: "default",
      messageThreadId: 42,
    }));
    expect(sendMessage).toHaveBeenCalledWith("chat-123", "Approval requested", expect.objectContaining({
      token: "tg-token",
      accountId: "default",
      messageThreadId: 42,
      buttons: [[{ text: "Approve", callback_data: "/approve req-1 allow-once" }]],
    }));
    expect(result).toEqual({ chatId: "chat-123", messageId: "msg-456" });
  });

  it("clears pending actions by editing reply markup", async () => {
    const editReplyMarkup = vi.fn().mockResolvedValue({});

    await (telegramApprovalNativeRuntime.interactions as any)?.clearPendingActions({
      cfg: {} as never,
      accountId: "default",
      phase: "resolved",
      context: {
        token: "tg-token",
        deps: {
          editReplyMarkup,
        },
      },
      entry: {
        chatId: "chat-123",
        messageId: "msg-456",
      },
    });

    expect(editReplyMarkup).toHaveBeenCalledWith("chat-123", "msg-456", [], expect.objectContaining({
      token: "tg-token",
      accountId: "default",
    }));
  });
});
