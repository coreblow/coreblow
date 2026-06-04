import { resolveFireworksThinkingProfile } from "./thinking-policy.js";

export function resolveThinkingProfile(params: {
  provider?: string;
  modelId: string;
}): ReturnType<typeof resolveFireworksThinkingProfile> {
  if (params.provider && !["fireworks", "fireworks-ai"].includes(params.provider.trim().toLowerCase())) {
    return undefined;
  }
  return resolveFireworksThinkingProfile(params.modelId);
}
