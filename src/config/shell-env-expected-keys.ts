import { listKnownProviderAuthEnvVarNames } from "../secrets/provider-env-vars.js";

const CORE_SHELL_ENV_EXPECTED_KEYS = [
  "COREBLOW_GATEWAY_TOKEN",
  "COREBLOW_GATEWAY_PASSWORD",
] as const;

const CHANNEL_ENV_PREFIXES = [
  "BLUEBUBBLES_",
  "DISCORD_",
  "GOOGLECHAT_",
  "IRC_",
  "LINE_",
  "MATRIX_",
  "MSTEAMS_",
  "SIGNAL_",
  "SLACK_",
  "TELEGRAM_",
  "WHATSAPP_",
  "ZALOUSER_",
  "ZALO_",
] as const;

export function listKnownChannelEnvVarNames(env: NodeJS.ProcessEnv = process.env): string[] {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      continue;
    }
    if (key === "TELEGRAM_BOT_TOKEN" || CHANNEL_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keys.add(key);
    }
  }
  return [...keys];
}

export function resolveShellEnvExpectedKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    ...new Set([
      ...listKnownProviderAuthEnvVarNames(),
      ...listKnownChannelEnvVarNames(env),
      ...CORE_SHELL_ENV_EXPECTED_KEYS,
    ]),
  ];
}
