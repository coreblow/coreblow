import type { MediaUnderstandingProvider } from "coreblow/plugin-sdk/media-understanding";
import { transcribeDeepgramAudio } from "./audio.js";

export const deepgramMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: "deepgram",
  capabilities: ["audio"],
  transcribeAudio: transcribeDeepgramAudio,
};
