export { XIAOMI_DEFAULT_MODEL_ID, buildXiaomiProvider } from "./provider-catalog.js";
export {
  applyXiaomiConfig,
  applyXiaomiProviderConfig,
  XIAOMI_DEFAULT_MODEL_REF,
} from "./onboard.js";
export { buildXiaomiSpeechProvider } from "./speech-provider.js";
export { createMiMoThinkingWrapper } from "./stream.js";
export {
  isMiMoReasoningModelId,
  isMiMoReasoningModelRef,
  resolveMiMoDefaultThinkingLevel,
  supportsMiMoXHighThinking,
} from "./thinking.js";

export function applyXiaomiModelCompat<T extends { compat?: unknown }>(model: T): T {
  const compat =
    model.compat && typeof model.compat === "object" && !Array.isArray(model.compat)
      ? (model.compat as Record<string, unknown>)
      : {};
  if (compat.omitEmptyArrayItems === true) {
    return model;
  }
  return {
    ...model,
    compat: {
      ...compat,
      omitEmptyArrayItems: true,
    },
  };
}
