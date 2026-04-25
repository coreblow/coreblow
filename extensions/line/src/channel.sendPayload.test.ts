import { describe, expect, it, vi , Mock } from "vitest";
import type { CoreBlowConfig, PluginRuntime } from "../api.js";
import { linePlugin } from "./channel.js";
import { setLineRuntime } from "./runtime.js";

type LineRuntimeMocks = {
  pushMessageLine: Mock;
  pushMessagesLine: Mock;
  pushFlexMessage: Mock;
  pushTemplateMessage: Mock;
  pushLocationMessage: Mock;
  pushTextMessageWithQuickReplies: Mock;
  createQuickReplyItems: Mock;
  buildTemplateMessageFromPayload: Mock;
  sendMessageLine: Mock;
  chunkMarkdownText: Mock;
  resolveLineAccount: Mock;
  resolveTextChunkLimit: Mock;
};

function createRuntime(): { runtime: PluginRuntime; mocks: LineRuntimeMocks } {
  const pushMessageLine = vi.fn(async () => ({ messageId: "m-text", chatId: "c1" }));
  const pushMessagesLine = vi.fn(async () => ({ messageId: "m-batch", chatId: "c1" }));
  const pushFlexMessage = vi.fn(async () => ({ messageId: "m-flex", chatId: "c1" }));
  const pushTemplateMessage = vi.fn(async () => ({ messageId: "m-template", chatId: "c1" }));
  const pushLocationMessage = vi.fn(async () => ({ messageId: "m-loc", chatId: "c1" }));
  const pushTextMessageWithQuickReplies = vi.fn(async () => ({
    messageId: "m-quick",
    chatId: "c1",
  }));
  const createQuickReplyItems = vi.fn((labels: string[]) => ({ items: labels }));
  const buildTemplateMessageFromPayload = vi.fn(() => ({ type: "buttons" }));
  const sendMessageLine = vi.fn(async () => ({ messageId: "m-media", chatId: "c1" }));
  const chunkMarkdownText = vi.fn((text: string) => [text]);
  const resolveTextChunkLimit = vi.fn(() => 123);
  const resolveLineAccount = vi.fn(
    ({ cfg, accountId }: { cfg: CoreBlowConfig; accountId?: string }) => {
      const resolved = accountId ?? "default";
      const lineConfig = (cfg.channels?.line ?? {}) as {
        accounts?: Record<string, Record<string, unknown>>;
      };
      const accountConfig = resolved !== "default" ? (lineConfig.accounts?.[resolved] ?? {}) : {};
      return {
        accountId: resolved,
        config: { ...lineConfig, ...accountConfig },
      };
    },
  );

  const runtime = {
    channel: {
      line: {
        pushMessageLine,
        pushMessagesLine,
        pushFlexMessage,
        pushTemplateMessage,
        pushLocationMessage,
        pushTextMessageWithQuickReplies,
        createQuickReplyItems,
        buildTemplateMessageFromPayload,
        sendMessageLine,
        resolveLineAccount,
      },
      text: {
        chunkMarkdownText,
        resolveTextChunkLimit,
      },
    },
  } as unknown as PluginRuntime;

  return {
    runtime,
    mocks: {
      pushMessageLine,
      pushMessagesLine,
      pushFlexMessage,
      pushTemplateMessage,
      pushLocationMessage,
      pushTextMessageWithQuickReplies,
      createQuickReplyItems,
      buildTemplateMessageFromPayload,
      sendMessageLine,
      chunkMarkdownText,
      resolveLineAccount,
      resolveTextChunkLimit,
    },
  };
}

describe("linePlugin outbound.sendPayload", () => {
  it("preserves resolved accountId when pairing notifications push directly", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = {
      channels: {
        line: {
          accounts: {
            primary: {
              channelAccessToken: "token-primary",
            },
          },
        },
      },
    } as CoreBlowConfig;
    mocks.resolveLineAccount.mockReturnValue({
      accountId: "primary",
      channelAccessToken: "token-primary",
      config: {},
    });

    await linePlugin.pairing!.notifyApproval!({
      cfg,
      id: "line:user:1",
    });

    expect(mocks.pushMessageLine).toHaveBeenCalledWith(
      "line:user:1",
      "CoreBlow: your access has been approved.",
      {
        accountId: "primary",
        channelAccessToken: "token-primary",
      },
    );
  });

  it("sends flex message without dropping text", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: {} } } as CoreBlowConfig;

    const payload = {
      text: "Now playing:",
      channelData: {
        line: {
          flexMessage: {
            altText: "Now playing",
            contents: { type: "bubble" },
          },
        },
      },
    };

    await linePlugin.outbound!.sendPayload!({
      to: "line:group:1",
      text: payload.text,
      payload,
      accountId: "default",
      cfg,
    });

    expect(mocks.pushFlexMessage).toHaveBeenCalledTimes(1);
    expect(mocks.pushMessageLine).toHaveBeenCalledWith("line:group:1", "Now playing:", {
      verbose: false,
      accountId: "default",
      cfg,
    });
  });

  it("sends template message without dropping text", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: {} } } as CoreBlowConfig;

    const payload = {
      text: "Choose one:",
      channelData: {
        line: {
          templateMessage: {
            type: "confirm",
            text: "Continue?",
            confirmLabel: "Yes",
            confirmData: "yes",
            cancelLabel: "No",
            cancelData: "no",
          },
        },
      },
    };

    await linePlugin.outbound!.sendPayload!({
      to: "line:user:1",
      text: payload.text,
      payload,
      accountId: "default",
      cfg,
    });

    expect(mocks.buildTemplateMessageFromPayload).toHaveBeenCalledTimes(1);
    expect(mocks.pushTemplateMessage).toHaveBeenCalledTimes(1);
    expect(mocks.pushMessageLine).toHaveBeenCalledWith("line:user:1", "Choose one:", {
      verbose: false,
      accountId: "default",
      cfg,
    });
  });

  it("attaches quick replies when no text chunks are present", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: {} } } as CoreBlowConfig;

    const payload = {
      channelData: {
        line: {
          quickReplies: ["One", "Two"],
          flexMessage: {
            altText: "Card",
            contents: { type: "bubble" },
          },
        },
      },
    };

    await linePlugin.outbound!.sendPayload!({
      to: "line:user:2",
      text: "",
      payload,
      accountId: "default",
      cfg,
    });

    expect(mocks.pushFlexMessage).not.toHaveBeenCalled();
    expect(mocks.pushMessagesLine).toHaveBeenCalledWith(
      "line:user:2",
      [
        {
          type: "flex",
          altText: "Card",
          contents: { type: "bubble" },
          quickReply: { items: ["One", "Two"] },
        },
      ],
      { verbose: false, accountId: "default", cfg },
    );
    expect(mocks.createQuickReplyItems).toHaveBeenCalledWith(["One", "Two"]);
  });

  it("sends media before quick-reply text so buttons stay visible", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: {} } } as CoreBlowConfig;

    const payload = {
      text: "Hello",
      mediaUrl: "https://example.com/img.jpg",
      channelData: {
        line: {
          quickReplies: ["One", "Two"],
        },
      },
    };

    await linePlugin.outbound!.sendPayload!({
      to: "line:user:3",
      text: payload.text,
      payload,
      accountId: "default",
      cfg,
    });

    expect(mocks.sendMessageLine).toHaveBeenCalledWith("line:user:3", "", {
      verbose: false,
      mediaUrl: "https://example.com/img.jpg",
      accountId: "default",
      cfg,
    });
    expect(mocks.pushTextMessageWithQuickReplies).toHaveBeenCalledWith(
      "line:user:3",
      "Hello",
      ["One", "Two"],
      { verbose: false, accountId: "default", cfg },
    );
    const mediaOrder = mocks.sendMessageLine.mock.invocationCallOrder[0];
    const quickReplyOrder = mocks.pushTextMessageWithQuickReplies.mock.invocationCallOrder[0];
    expect(mediaOrder).toBeLessThan(quickReplyOrder);
  });

  it("uses configured text chunk limit for payloads", async () => {
    const { runtime, mocks } = createRuntime();
    setLineRuntime(runtime);
    const cfg = { channels: { line: { textChunkLimit: 123 } } } as CoreBlowConfig;

    const payload = {
      text: "Hello world",
      channelData: {
        line: {
          flexMessage: {
            altText: "Card",
            contents: { type: "bubble" },
          },
        },
      },
    };

    await linePlugin.outbound!.sendPayload!({
      to: "line:user:3",
      text: payload.text,
      payload,
      accountId: "primary",
      cfg,
    });

    expect(mocks.resolveTextChunkLimit).toHaveBeenCalledWith(cfg, "line", "primary", {
      fallbackLimit: 5000,
    });
    expect(mocks.chunkMarkdownText).toHaveBeenCalledWith("Hello world", 123);
  });
});

describe("linePlugin config.formatAllowFrom", () => {
  it("strips line:user: prefixes without lowercasing", () => {
    const formatted = linePlugin.config.formatAllowFrom!({
      cfg: {} as CoreBlowConfig,
      allowFrom: ["line:user:UABC", "line:UDEF"],
    });
    expect(formatted).toEqual(["UABC", "UDEF"]);
  });
});

describe("linePlugin groups.resolveRequireMention", () => {
  it("uses account-level group settings when provided", () => {
    const { runtime } = createRuntime();
    setLineRuntime(runtime);

    const cfg = {
      channels: {
        line: {
          groups: {
            "*": { requireMention: false },
          },
          accounts: {
            primary: {
              groups: {
                "group-1": { requireMention: true },
              },
            },
          },
        },
      },
    } as CoreBlowConfig;

    const requireMention = linePlugin.groups!.resolveRequireMention!({
      cfg,
      accountId: "primary",
      groupId: "group-1",
    });

    expect(requireMention).toBe(true);
  });
});
