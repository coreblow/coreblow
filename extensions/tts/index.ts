import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "tts",
  name: "TTS Compatibility",
  description: "Deprecated legacy tts plugin surface; speech synthesis is provided by core voice-runtime",
  register(api) {
    api.logger.warn("Legacy 'tts' extension is deprecated; core speech engine is used instead.");
  },
});
