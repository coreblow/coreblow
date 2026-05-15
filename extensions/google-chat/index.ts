/**
 * extensions/google-chat/index.ts
 * Compatibility entry for the legacy google-chat plugin id.
 */
import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "google-chat",
  name: "Google Chat Compatibility",
  description: "Compatibility shim for the legacy google-chat plugin id; use googlechat.",
  register(api) {
    api.logger.warn("google-chat is a legacy plugin id; use the googlechat channel plugin.");
    api.registerCommand({
      name: "google-chat",
      description: "Show the replacement Google Chat plugin id.",
      requireAuth: false,
      handler: async () => ({
        text: "Google Chat moved to the googlechat plugin id. Use channel googlechat.",
      }),
    });
  },
});
