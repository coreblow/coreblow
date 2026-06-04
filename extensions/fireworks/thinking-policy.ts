import { isFireworksKimiModelId } from "./model-id.js";

const FIREWORKS_KIMI_THINKING_PROFILE = {
  levels: [{ id: "off" }],
  defaultLevel: "off",
} as const;

export function resolveFireworksThinkingProfile(modelId: string) {
  if (!isFireworksKimiModelId(modelId)) {
    return undefined;
  }
  return FIREWORKS_KIMI_THINKING_PROFILE;
}
