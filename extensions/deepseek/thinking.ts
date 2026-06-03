import { isDeepSeekV4ModelId } from "./models.js";

const DEEPSEEK_V4_THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

function buildThinkingLevel(id: (typeof DEEPSEEK_V4_THINKING_LEVELS)[number]) {
  return { id };
}

export function resolveDeepSeekV4ThinkingProfile(modelId: string) {
  if (!isDeepSeekV4ModelId(modelId)) {
    return undefined;
  }
  return {
    levels: DEEPSEEK_V4_THINKING_LEVELS.map(buildThinkingLevel),
    defaultLevel: "high",
  } as const;
}
