import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import { migrateElevenLabsLegacyTalkConfig } from "./config-compat.js";

export { migrateElevenLabsLegacyTalkConfig } from "./config-compat.js";

export default definePluginEntry({
  id: "elevenlabs",
  name: "ElevenLabs Setup",
  description: "Lightweight ElevenLabs setup hooks",
  register() {
    // CoreBlow exposes this setup migration as a facade until config migrations
    // become a plugin-entry registration surface.
  },
});
