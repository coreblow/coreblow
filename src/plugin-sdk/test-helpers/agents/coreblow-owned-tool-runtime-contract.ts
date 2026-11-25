import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { vi } from "vitest";
import { resetAdjustedParamsByToolCallIdForTests } from "../../../agents/pi-tools.before-tool-call.state.js";
import {
  initializeGlobalHookRunner,
  resetGlobalHookRunner,
} from "../../../plugins/hook-runner-global.js";
import { createMockPluginRegistry } from "../../../plugins/hooks.test-helpers.js";
import {
  resetPluginRuntimeStateForTest,
} from "../../../plugins/runtime.js";

export function textToolResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

export function mediaToolResult(
  text: string,
  mediaUrl: string,
  audioAsVoice = false,
): AgentToolResult<unknown> {
  return textToolResult(text, {
    media: {
      mediaUrl,
      ...(audioAsVoice ? { audioAsVoice } : {}),
    },
  });
}

export function installCoreBlowOwnedToolHooks(params?: {
  adjustedParams?: Record<string, unknown>;
  blockReason?: string;
}) {
  const beforeToolCall = vi.fn(async () => {
    if (params?.blockReason) {
      return {
        block: true,
        blockReason: params.blockReason,
      };
    }
    return params?.adjustedParams ? { params: params.adjustedParams } : {};
  });
  const afterToolCall = vi.fn(async () => {});
  initializeGlobalHookRunner(
    createMockPluginRegistry([
      { hookName: "before_tool_call", handler: beforeToolCall },
      { hookName: "after_tool_call", handler: afterToolCall },
    ]),
  );
  return { beforeToolCall, afterToolCall };
}

export function resetCoreBlowOwnedToolHooks(): void {
  resetGlobalHookRunner();
  resetPluginRuntimeStateForTest();
  resetAdjustedParamsByToolCallIdForTests();
}
