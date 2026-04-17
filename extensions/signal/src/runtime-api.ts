// Private runtime barrel for the bundled Signal extension.
// Prefer narrower SDK subpaths plus local extension seams over the legacy signal barrel.

export type { ChannelMessageActionAdapter } from "coreblow/plugin-sdk/channel-contract";
export { SignalConfigSchema } from "coreblow/plugin-sdk/channel-config-schema";
export { PAIRING_APPROVED_MESSAGE } from "coreblow/plugin-sdk/channel-status";
import type { CoreBlowConfig as RuntimeCoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
export type { RuntimeCoreBlowConfig as CoreBlowConfig };
export type { CoreBlowPluginApi, PluginRuntime } from "coreblow/plugin-sdk/core";
export type { ChannelPlugin } from "coreblow/plugin-sdk/core";
export {
  DEFAULT_ACCOUNT_ID,
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  deleteAccountFromConfigSection,
  emptyPluginConfigSchema,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
} from "coreblow/plugin-sdk/core";
export { resolveChannelMediaMaxBytes } from "coreblow/plugin-sdk/media-runtime";
export { formatCliCommand, formatDocsLink } from "coreblow/plugin-sdk/setup-tools";
export { chunkText } from "coreblow/plugin-sdk/reply-runtime";
export { detectBinary, installSignalCli } from "coreblow/plugin-sdk/setup-tools";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
} from "coreblow/plugin-sdk/config-runtime";
export {
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
} from "coreblow/plugin-sdk/status-helpers";
export { normalizeE164 } from "coreblow/plugin-sdk/text-runtime";
export { looksLikeSignalTargetId, normalizeSignalMessagingTarget } from "./normalize.js";
export {
  listEnabledSignalAccounts,
  listSignalAccountIds,
  resolveDefaultSignalAccountId,
  resolveSignalAccount,
} from "./accounts.js";
export { monitorSignalProvider } from "./monitor.js";
export { probeSignal } from "./probe.js";
export { resolveSignalReactionLevel } from "./reaction-level.js";
export { removeReactionSignal, sendReactionSignal } from "./send-reactions.js";
export { sendMessageSignal } from "./send.js";
export { signalMessageActions } from "./message-actions.js";
export type { ResolvedSignalAccount } from "./accounts.js";
export type SignalAccountConfig = Omit<
  Exclude<NonNullable<RuntimeCoreBlowConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
