import { isOpenRouterDeepSeekV4ModelId } from "./models.js";

export const OPENROUTER_DEEPSEEK_V4_THINKING_LEVEL_IDS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type OpenRouterThinkingLevelId = (typeof OPENROUTER_DEEPSEEK_V4_THINKING_LEVEL_IDS)[number];

export type OpenRouterThinkingProfile = {
  levels: Array<{ id: OpenRouterThinkingLevelId }>;
  defaultLevel: OpenRouterThinkingLevelId;
};

const OPENROUTER_DEEPSEEK_V4_THINKING_PROFILE = {
  levels: OPENROUTER_DEEPSEEK_V4_THINKING_LEVEL_IDS.map((id) => ({ id })),
  defaultLevel: "high",
} satisfies OpenRouterThinkingProfile;

export function supportsOpenRouterXHighThinking(modelId: string): boolean {
  return isOpenRouterDeepSeekV4ModelId(modelId);
}

export function resolveOpenRouterThinkingProfile(
  modelId: string,
): OpenRouterThinkingProfile | undefined {
  return isOpenRouterDeepSeekV4ModelId(modelId)
    ? OPENROUTER_DEEPSEEK_V4_THINKING_PROFILE
    : undefined;
}
