import type { CoreBlowPluginApi } from "coreblow/plugin-sdk/plugin-entry";
import {
  buildMinimaxImageGenerationProvider,
  buildMinimaxPortalImageGenerationProvider,
} from "./image-generation-provider.js";
import {
  buildMinimaxMusicGenerationProvider,
  buildMinimaxPortalMusicGenerationProvider,
} from "./music-generation-provider.js";
import {
  minimaxMediaUnderstandingProvider,
  minimaxPortalMediaUnderstandingProvider,
} from "./media-understanding-provider.js";
import { buildMinimaxSpeechProvider } from "./speech-provider.js";
import { createMiniMaxWebSearchProvider } from "./src/minimax-web-search-provider.js";
import {
  buildMinimaxPortalVideoGenerationProvider,
  buildMinimaxVideoGenerationProvider,
} from "./video-generation-provider.js";

export function registerMinimaxCapabilityProviders(api: CoreBlowPluginApi): void {
  api.registerMediaUnderstandingProvider(minimaxMediaUnderstandingProvider);
  api.registerMediaUnderstandingProvider(minimaxPortalMediaUnderstandingProvider);
  api.registerImageGenerationProvider(buildMinimaxImageGenerationProvider());
  api.registerImageGenerationProvider(buildMinimaxPortalImageGenerationProvider());
  api.registerSpeechProvider(buildMinimaxSpeechProvider());
  api.registerMusicGenerationProvider(buildMinimaxMusicGenerationProvider());
  api.registerMusicGenerationProvider(buildMinimaxPortalMusicGenerationProvider());
  api.registerVideoGenerationProvider(buildMinimaxVideoGenerationProvider());
  api.registerVideoGenerationProvider(buildMinimaxPortalVideoGenerationProvider());
  api.registerWebSearchProvider(createMiniMaxWebSearchProvider());
}

export const registerMinimaxProviders = registerMinimaxCapabilityProviders;
