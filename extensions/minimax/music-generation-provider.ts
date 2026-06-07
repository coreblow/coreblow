import type { MusicGenerationProvider } from "coreblow/plugin-sdk/music-generation";
import { isProviderApiKeyConfigured } from "coreblow/plugin-sdk/provider-auth";

const DEFAULT_MINIMAX_MUSIC_MODEL = "music-2.6";

export function buildMinimaxMusicGenerationProvider(providerId = "minimax"): MusicGenerationProvider {
  return {
    id: providerId,
    label: "MiniMax",
    defaultModel: DEFAULT_MINIMAX_MUSIC_MODEL,
    models: [DEFAULT_MINIMAX_MUSIC_MODEL, "music-2.6-free", "music-cover", "music-cover-free"],
    isConfigured: ({ agentDir }) => isProviderApiKeyConfigured({ provider: providerId, agentDir }),
    capabilities: {
      maxTracks: 1,
      supportsLyrics: true,
      supportsInstrumental: true,
      supportsDuration: true,
      supportsFormat: true,
      supportedFormats: ["mp3"],
      generate: {
        maxTracks: 1,
        supportsLyrics: true,
        supportsInstrumental: true,
        supportsDuration: true,
        supportsFormat: true,
        supportedFormats: ["mp3"],
      },
      edit: { enabled: false },
    },
    async generateMusic() {
      throw new Error("MiniMax music generation runtime is not configured for this CoreBlow build.");
    },
  };
}

export function buildMinimaxPortalMusicGenerationProvider(): MusicGenerationProvider {
  return buildMinimaxMusicGenerationProvider("minimax-portal");
}
