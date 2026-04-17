// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  CoreBlowConfig as ClawdbotConfig,
  CoreBlowConfig,
  CoreBlowPluginApi,
  PluginRuntime,
  RuntimeEnv,
} from "coreblow/plugin-sdk/feishu";
export {
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  buildChannelConfigSchema,
  buildProbeChannelStatusSummary,
  createActionGate,
  createDefaultChannelRuntimeState,
} from "coreblow/plugin-sdk/feishu";
export * from "coreblow/plugin-sdk/feishu";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "coreblow/plugin-sdk/webhook-ingress";
