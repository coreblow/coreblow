const MIMO_REASONING_MODEL_IDS = new Set([
  "mimo-v2-pro",
  "mimo-v2-omni",
  "mimo-v2.5",
  "mimo-v2.5-pro",
  "mimo-v2.6-pro",
]);

export function isMiMoReasoningModelId(modelId: string): boolean {
  return MIMO_REASONING_MODEL_IDS.has(modelId.toLowerCase());
}

export function isMiMoReasoningModelRef(model: { provider?: string; id?: unknown }): boolean {
  return (
    model.provider === "xiaomi" && typeof model.id === "string" && isMiMoReasoningModelId(model.id)
  );
}

export function resolveMiMoDefaultThinkingLevel(modelId: string): "high" | undefined {
  return isMiMoReasoningModelId(modelId) ? "high" : undefined;
}

export function supportsMiMoXHighThinking(modelId: string): boolean | undefined {
  return isMiMoReasoningModelId(modelId) ? true : undefined;
}
