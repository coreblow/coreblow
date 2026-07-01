import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import type { ThreadBindingManager } from "./thread-bindings.js";

type DiscordConfig = NonNullable<CoreBlowConfig["channels"]>["discord"];

export type DiscordCommandArgContext = {
  cfg: CoreBlowConfig;
  discordConfig: DiscordConfig;
  accountId: string;
  sessionPrefix: string;
  threadBindings: ThreadBindingManager;
  postApplySettleMs?: number;
};

export type DiscordModelPickerContext = DiscordCommandArgContext;

export type SafeDiscordInteractionCall = <T>(
  label: string,
  fn: () => Promise<T>,
) => Promise<T | null>;
