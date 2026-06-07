import type { VideoGenerationProvider } from "coreblow/plugin-sdk/video-generation";
import { isProviderApiKeyConfigured } from "coreblow/plugin-sdk/provider-auth";

const DEFAULT_MINIMAX_VIDEO_MODEL = "MiniMax-Hailuo-2.3";

export function buildMinimaxVideoGenerationProvider(providerId = "minimax"): VideoGenerationProvider {
  return {
    id: providerId,
    label: "MiniMax",
    defaultModel: DEFAULT_MINIMAX_VIDEO_MODEL,
    models: [DEFAULT_MINIMAX_VIDEO_MODEL, "MiniMax-Hailuo-2.3-Fast", "MiniMax-Hailuo-02"],
    isConfigured: ({ agentDir }) => isProviderApiKeyConfigured({ provider: providerId, agentDir }),
    capabilities: {
      maxDurationSeconds: 10,
      maxInputImages: 1,
      resolutions: ["768P", "1080P"],
      supportsResolution: true,
    },
    async generateVideo() {
      throw new Error("MiniMax video generation runtime is not configured for this CoreBlow build.");
    },
  };
}

export function buildMinimaxPortalVideoGenerationProvider(): VideoGenerationProvider {
  return buildMinimaxVideoGenerationProvider("minimax-portal");
}
