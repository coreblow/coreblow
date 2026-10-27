import fs from "node:fs";
import path from "node:path";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveOAuthDir } from "../config/paths.js";
import { DEFAULT_ACCOUNT_ID } from "../routing/session-key.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";

const IGNORED_CHANNEL_CONFIG_KEYS = new Set(["defaults", "modelByChannel"]);

const CHANNEL_ENV_PREFIXES = [
  ["BLUEBUBBLES_", "bluebubbles"],
  ["DISCORD_", "discord"],
  ["GOOGLECHAT_", "googlechat"],
  ["IRC_", "irc"],
  ["LINE_", "line"],
  ["MATRIX_", "matrix"],
  ["MSTEAMS_", "msteams"],
  ["SIGNAL_", "signal"],
  ["SLACK_", "slack"],
  ["TELEGRAM_", "telegram"],
  ["WHATSAPP_", "whatsapp"],
  ["ZALOUSER_", "zalouser"],
  ["ZALO_", "zalo"],
] as const;

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function hasMeaningfulChannelConfig(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return Object.keys(value).some((key) => key !== "enabled");
}

export function listExplicitlyDisabledChannelIdsForConfig(cfg: CoreBlowConfig): string[] {
  const channels = isRecord(cfg.channels) ? cfg.channels : null;
  if (!channels) {
    return [];
  }
  return Object.entries(channels)
    .filter(([, value]) => isRecord(value) && value.enabled === false)
    .map(([channelId]) => normalizeOptionalLowercaseString(channelId))
    .filter((channelId): channelId is string => Boolean(channelId));
}

export type ChannelPresenceSignalSource = "config" | "env" | "persisted-auth";

export type ChannelPresenceSignal = {
  channelId: string;
  source: ChannelPresenceSignalSource;
};

export type ChannelPresenceOptions = {
  channelIds?: readonly string[];
  includePersistedAuthState?: boolean;
  persistedAuthStateProbe?: {
    listChannelIds: () => readonly string[];
    hasState: (params: {
      channelId: string;
      cfg: CoreBlowConfig;
      env: NodeJS.ProcessEnv;
    }) => boolean;
  };
};

function hasWhatsAppAuthState(env: NodeJS.ProcessEnv): boolean {
  try {
    const oauthDir = resolveOAuthDir(env);
    const legacyCreds = path.join(oauthDir, "creds.json");
    if (fs.existsSync(legacyCreds)) {
      return true;
    }

    const accountsRoot = path.join(oauthDir, "whatsapp");
    const defaultCreds = path.join(accountsRoot, DEFAULT_ACCOUNT_ID, "creds.json");
    if (fs.existsSync(defaultCreds)) {
      return true;
    }

    const entries = fs.readdirSync(accountsRoot, { withFileTypes: true });
    return entries.some((entry) => {
      if (!entry.isDirectory()) {
        return false;
      }
      return fs.existsSync(path.join(accountsRoot, entry.name, "creds.json"));
    });
  } catch {
    return false;
  }
}

export function listPotentialConfiguredChannelIds(
  cfg: CoreBlowConfig,
  env: NodeJS.ProcessEnv = process.env,
  options: ChannelPresenceOptions = {},
): string[] {
  return [
    ...new Set(
      listPotentialConfiguredChannelPresenceSignals(cfg, env, options).map(
        (signal) => signal.channelId,
      ),
    ),
  ];
}

export function listPotentialConfiguredChannelPresenceSignals(
  cfg: CoreBlowConfig,
  env: NodeJS.ProcessEnv = process.env,
  options: ChannelPresenceOptions = {},
): ChannelPresenceSignal[] {
  const signals: ChannelPresenceSignal[] = [];
  const seenSignals = new Set<string>();
  const addSignal = (channelId: string, source: ChannelPresenceSignalSource) => {
    const key = `${source}:${channelId}`;
    if (seenSignals.has(key)) {
      return;
    }
    seenSignals.add(key);
    signals.push({ channelId, source });
  };
  const configuredChannelIds = new Set<string>();
  const channelEnvPrefixes = options.channelIds
    ? options.channelIds.map(
        (id) => [`${id.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_`, id] as const,
      )
    : CHANNEL_ENV_PREFIXES;
  const channels = isRecord(cfg.channels) ? cfg.channels : null;
  if (channels) {
    for (const [key, value] of Object.entries(channels)) {
      if (IGNORED_CHANNEL_CONFIG_KEYS.has(key)) {
        continue;
      }
      if (hasMeaningfulChannelConfig(value)) {
        configuredChannelIds.add(key);
        addSignal(key, "config");
      }
    }
  }

  for (const [key, value] of Object.entries(env)) {
    if (!hasNonEmptyString(value)) {
      continue;
    }
    for (const [prefix, channelId] of channelEnvPrefixes) {
      if (key.startsWith(prefix)) {
        configuredChannelIds.add(channelId);
        addSignal(channelId, "env");
      }
    }
    if (key === "TELEGRAM_BOT_TOKEN") {
      configuredChannelIds.add("telegram");
      addSignal("telegram", "env");
    }
  }

  if (options.includePersistedAuthState !== false && hasWhatsAppAuthState(env)) {
    configuredChannelIds.add("whatsapp");
    addSignal("whatsapp", "persisted-auth");
  }

  return signals.filter((signal) => configuredChannelIds.has(signal.channelId));
}

function hasEnvConfiguredChannel(env: NodeJS.ProcessEnv): boolean {
  for (const [key, value] of Object.entries(env)) {
    if (!hasNonEmptyString(value)) {
      continue;
    }
    if (
      CHANNEL_ENV_PREFIXES.some(([prefix]) => key.startsWith(prefix)) ||
      key === "TELEGRAM_BOT_TOKEN"
    ) {
      return true;
    }
  }
  return hasWhatsAppAuthState(env);
}

export function hasPotentialConfiguredChannels(
  cfg: CoreBlowConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const channels = isRecord(cfg.channels) ? cfg.channels : null;
  if (channels) {
    for (const [key, value] of Object.entries(channels)) {
      if (IGNORED_CHANNEL_CONFIG_KEYS.has(key)) {
        continue;
      }
      if (hasMeaningfulChannelConfig(value)) {
        return true;
      }
    }
  }
  return hasEnvConfiguredChannel(env);
}
