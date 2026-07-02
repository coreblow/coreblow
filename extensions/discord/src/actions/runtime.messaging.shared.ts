import { resolveDefaultDiscordAccountId } from "../accounts.js";
import { createDiscordRuntimeAccountContext } from "../client.js";
import {
  type ActionGate,
  readStringParam,
  type DiscordActionConfig,
  type CoreBlowConfig,
  withNormalizedTimestamp,
} from "../runtime-api.js";
import type { DiscordReactOpts } from "../send.types.js";
import { discordMessagingActionRuntime } from "./runtime.messaging.runtime.js";

export type DiscordMessagingActionOptions = {
  mediaLocalRoots?: readonly string[];
};

export type DiscordMessagingActionContext = {
  action: string;
  params: Record<string, unknown>;
  isActionEnabled: ActionGate<DiscordActionConfig>;
  cfg: CoreBlowConfig;
  options?: DiscordMessagingActionOptions;
  hasConfig: boolean;
  accountId?: string;
  resolveChannelId: () => string;
  resolveReactionChannelId: () => Promise<string>;
  withOpts: (extra?: Record<string, unknown>) => { cfg: CoreBlowConfig; accountId?: string };
  withReactionRuntimeOptions: <T extends Record<string, unknown> = Record<string, never>>(
    extra?: T,
  ) => DiscordReactOpts & T;
  normalizeMessage: (message: unknown) => unknown;
};

export function createDiscordMessagingActionContext(params: {
  action: string;
  input: Record<string, unknown>;
  isActionEnabled: ActionGate<DiscordActionConfig>;
  cfg: CoreBlowConfig;
  options?: DiscordMessagingActionOptions;
  hasConfig?: boolean;
}): DiscordMessagingActionContext {
  const accountId = readStringParam(params.input, "accountId");
  const hasConfig = params.hasConfig ?? true;
  const cfgOptions = hasConfig ? { cfg: params.cfg } : {};
  const withOpts = (extra?: Record<string, unknown>) =>
    ({
      ...cfgOptions,
      ...(accountId ? { accountId } : {}),
      ...(extra ?? {}),
    }) as { cfg: CoreBlowConfig; accountId?: string } & Record<string, unknown>;
  const resolvedReactionAccountId = accountId ?? (hasConfig ? resolveDefaultDiscordAccountId(params.cfg) : undefined);
  const reactionRuntimeOptions = resolvedReactionAccountId
    ? hasConfig
      ? createDiscordRuntimeAccountContext({
          cfg: params.cfg,
          accountId: resolvedReactionAccountId,
        })
      : { accountId: resolvedReactionAccountId }
    : cfgOptions;
  return {
    action: params.action,
    params: params.input,
    isActionEnabled: params.isActionEnabled,
    cfg: params.cfg,
    options: params.options,
    hasConfig,
    accountId,
    resolveChannelId: () =>
      discordMessagingActionRuntime.resolveDiscordChannelId(
        readStringParam(params.input, "channelId", {
          required: true,
        }),
      ),
    resolveReactionChannelId: async () => {
      const target =
        readStringParam(params.input, "channelId") ??
        readStringParam(params.input, "to", { required: true });
      return await discordMessagingActionRuntime.resolveDiscordReactionTargetChannelId({
        target,
        cfg: params.cfg,
        accountId: resolvedReactionAccountId,
      });
    },
    withOpts,
    withReactionRuntimeOptions: (extra) =>
      ({
        ...(reactionRuntimeOptions ?? cfgOptions),
        ...extra,
      }) as DiscordReactOpts & NonNullable<typeof extra>,
    normalizeMessage: (message: unknown) => {
      if (!message || typeof message !== "object") {
        return message;
      }
      return withNormalizedTimestamp(
        message as Record<string, unknown>,
        (message as { timestamp?: unknown }).timestamp,
      );
    },
  };
}
