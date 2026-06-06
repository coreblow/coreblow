import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";
import { setActivePluginRegistry } from "../../plugins/runtime.js";
import { createChannelTestPluginBase, createTestRegistry } from "../../test-utils/channel-plugins.js";
import {
  createChannelReplyPipeline,
  resolveChannelSourceReplyDeliveryMode,
} from "./reply-pipeline.js";
import type { ChannelPlugin } from "../plugins/types.js";

const cfg = {
  messages: {
    responsePrefix: "{{identityName}}:",
  },
  agents: {
    default: {
      identity: { name: "CoreBot" },
    },
  },
} as unknown as CoreBlowConfig;

describe("channel reply pipeline", () => {
  afterEach(() => {
    setActivePluginRegistry(createTestRegistry());
  });

  it("creates prefix and typing callbacks from CoreBlow helpers", async () => {
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    const pipeline = createChannelReplyPipeline({
      cfg,
      agentId: "default",
      channel: "telegram",
      typing: {
        start,
        stop,
        onStartError: vi.fn(),
      },
    });

    expect(pipeline.responsePrefix).toBe("{{identityName}}:");
    expect(pipeline.responsePrefixContextProvider()).toEqual(
      expect.objectContaining({ identityName: undefined }),
    );
    await pipeline.typingCallbacks?.onReplyStart();
    pipeline.typingCallbacks?.onCleanup?.();
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("prefers explicit reply payload transforms", () => {
    const transformReplyPayload = vi.fn((payload) => ({ ...payload, text: "explicit" }));
    const pipeline = createChannelReplyPipeline({
      cfg,
      agentId: "default",
      channel: "telegram",
      transformReplyPayload,
    });

    expect(pipeline.transformReplyPayload?.({ text: "original" })).toEqual({ text: "explicit" });
    expect(transformReplyPayload).toHaveBeenCalledTimes(1);
  });

  it("lazily resolves plugin reply payload transforms", () => {
    const transformReplyPayload = vi.fn(({ payload }) => ({ ...payload, text: "plugin" }));
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "telegram",
          source: "test",
          plugin: {
            ...createChannelTestPluginBase({ id: "telegram", label: "Telegram" }),
            messaging: {
              transformReplyPayload,
            },
          } as ChannelPlugin,
        },
      ]),
    );

    const pipeline = createChannelReplyPipeline({
      cfg,
      agentId: "default",
      channel: "telegram",
      accountId: "work",
    });

    expect(transformReplyPayload).not.toHaveBeenCalled();
    expect(pipeline.transformReplyPayload?.({ text: "original" })).toEqual({ text: "plugin" });
    expect(transformReplyPayload).toHaveBeenCalledWith({
      payload: { text: "original" },
      cfg,
      accountId: "work",
    });
  });

  it("keeps CoreBlow source reply delivery mode requests stable", () => {
    expect(
      resolveChannelSourceReplyDeliveryMode({
        cfg,
        ctx: {},
        requested: "message_tool_only",
      }),
    ).toBe("message_tool_only");
    expect(
      resolveChannelSourceReplyDeliveryMode({
        cfg,
        ctx: { messageToolAvailable: true },
      }),
    ).toBe("message_tool_only");
  });
});
