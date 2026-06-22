import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import { definePluginEntry } from "./api.js";
import { normalizeVoiceCallLegacyConfigInput } from "./config-api.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function migrateVoiceCallPluginConfig(config: CoreBlowConfig): {
  config: CoreBlowConfig;
  changes: string[];
} | null {
  const rawVoiceCallConfig = asRecord(config.plugins?.entries?.["voice-call"]?.config);
  if (!rawVoiceCallConfig) {
    return null;
  }
  const normalized = normalizeVoiceCallLegacyConfigInput(rawVoiceCallConfig);
  if (JSON.stringify(normalized) === JSON.stringify(rawVoiceCallConfig)) {
    return null;
  }
  const plugins = structuredClone(config.plugins ?? {});
  const entries = { ...plugins.entries };
  const existingVoiceCallEntry = asRecord(entries["voice-call"]) ?? {};
  entries["voice-call"] = {
    ...existingVoiceCallEntry,
    config: normalized,
  };
  plugins.entries = entries;
  return {
    config: {
      ...config,
      plugins,
    },
    changes: ["Normalized legacy voice-call config shape."],
  };
}

export default definePluginEntry({
  id: "voice-call",
  name: "Voice Call Setup",
  description: "Lightweight Voice Call setup hooks",
  register(api: unknown) {
    const migrationApi = api as {
      registerConfigMigration?: (
        fn: (config: CoreBlowConfig) => { config: CoreBlowConfig; changes: string[] } | null,
      ) => void;
    };
    migrationApi.registerConfigMigration?.((config) => migrateVoiceCallPluginConfig(config));
  },
});
