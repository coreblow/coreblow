import type { DiscordAccountConfig } from "coreblow/plugin-sdk/discord";

export function resolveDiscordVoiceEnabled(voice: DiscordAccountConfig["voice"]): boolean {
  if (voice?.enabled !== undefined) {
    return voice.enabled;
  }
  return voice !== undefined;
}
