import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ActionGate, DiscordActionConfig, CoreBlowConfig } from "../runtime-api.js";
import { handleDiscordMessageManagementAction } from "./runtime.messaging.messages.js";
import { handleDiscordReactionMessagingAction } from "./runtime.messaging.reactions.js";
import { handleDiscordMessageSendAction } from "./runtime.messaging.send.js";
import {
  createDiscordMessagingActionContext,
  type DiscordMessagingActionOptions,
} from "./runtime.messaging.shared.js";

export { discordMessagingActionRuntime } from "./runtime.messaging.runtime.js";

/**
 * CoreBlow-compatible wrapper for Discord messaging actions.
 * Delegates to modular handlers while preserving existing signature.
 */
export async function handleDiscordMessagingAction(
  action: string,
  params: Record<string, unknown>,
  isActionEnabled: ActionGate<DiscordActionConfig>,
  options?: {
    mediaLocalRoots?: readonly string[];
  },
  cfg?: CoreBlowConfig,
): Promise<AgentToolResult<unknown>> {
  // Convert CoreBlow's simpler options format to modular DiscordMessagingActionOptions
  const modularOptions: DiscordMessagingActionOptions | undefined = options
    ? {
        mediaLocalRoots: options.mediaLocalRoots,
      }
    : undefined;

  const ctx = createDiscordMessagingActionContext({
    action,
    input: params,
    isActionEnabled,
    cfg: cfg ?? {},
    hasConfig: Boolean(cfg),
    options: modularOptions,
  });

  return (
    (await handleDiscordReactionMessagingAction(ctx)) ??
    (await handleDiscordMessageSendAction(ctx)) ??
    (await handleDiscordMessageManagementAction(ctx)) ??
    (() => {
      throw new Error(`Unknown action: ${action}`);
    })()
  );
}
