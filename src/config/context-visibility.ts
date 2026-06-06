import { isPlainObject } from "../infra/plain-object.js";
import type { CoreBlowConfig } from "./types.js";

export type ContextVisibilityMode = "all" | "allowlist" | "allowlist_quote";

type ContextVisibilityRecord = {
  contextVisibility?: ContextVisibilityMode;
  accounts?: Record<string, unknown>;
};

type ContextVisibilityDefaultsConfig = {
  channels?: unknown;
};

function isContextVisibilityMode(value: unknown): value is ContextVisibilityMode {
  return value === "all" || value === "allowlist" || value === "allowlist_quote";
}

function readContextVisibility(value: unknown): ContextVisibilityMode | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const mode = value.contextVisibility;
  return isContextVisibilityMode(mode) ? mode : undefined;
}

function normalizeAccountId(accountId: string | null | undefined): string | null {
  const normalized = accountId?.trim();
  return normalized ? normalized : null;
}

function resolveAccountConfig(
  accounts: Record<string, unknown> | undefined,
  accountId: string | null,
): unknown {
  if (!accounts || !accountId) {
    return undefined;
  }
  return accounts[accountId] ?? accounts[accountId.toLowerCase()];
}

export function resolveDefaultContextVisibility(
  cfg: ContextVisibilityDefaultsConfig,
): ContextVisibilityMode | undefined {
  if (!isPlainObject(cfg.channels)) {
    return undefined;
  }
  return readContextVisibility(cfg.channels.defaults);
}

export function resolveChannelContextVisibilityMode(params: {
  cfg: Pick<CoreBlowConfig, "channels">;
  channel: string;
  accountId?: string | null;
  configuredContextVisibility?: ContextVisibilityMode;
}): ContextVisibilityMode {
  if (params.configuredContextVisibility) {
    return params.configuredContextVisibility;
  }

  const rawChannelConfig = params.cfg.channels?.[params.channel];
  const channelConfig = isPlainObject(rawChannelConfig)
    ? (rawChannelConfig as ContextVisibilityRecord)
    : undefined;
  const accountId = normalizeAccountId(params.accountId);
  const accountMode = readContextVisibility(resolveAccountConfig(channelConfig?.accounts, accountId));
  return (
    accountMode ??
    readContextVisibility(channelConfig) ??
    resolveDefaultContextVisibility(params.cfg) ??
    "all"
  );
}
