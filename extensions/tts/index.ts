import { definePluginEntry, type AnyAgentTool } from "coreblow/plugin-sdk/plugin-entry";

const ttsTool: AnyAgentTool = {
  name: "tts",
  label: "TTS",
  description: "Convert text to speech audio",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to convert" },
      voice: { type: "string", description: "Voice preset" },
    },
    required: ["text"],
  },
  async execute(_toolCallId: string, params: unknown) {
    const args = params && typeof params === "object" ? params : {};
    const text = "text" in args && typeof args.text === "string" ? args.text : "";
    const voice =
      "voice" in args && typeof args.voice === "string" && args.voice ? args.voice : "alloy";
    return {
      content: [{ type: "text" as const, text: `TTS: "${text.substring(0, 100)}" voice=${voice}` }],
      details: { text, voice },
    };
  },
};

export default definePluginEntry({
  id: "tts",
  name: "TTS Compatibility",
  description: "Compatibility plugin for the legacy tts tool surface",
  register(api) {
    api.registerTool(ttsTool);
    api.logger.info("TTS compatibility plugin initialized");
  },
});
