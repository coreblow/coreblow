import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "coreblow/plugin-sdk/account-id";
import { resolveMergedAccountConfig } from "coreblow/plugin-sdk/account-resolution";
import { resolveDefaultSecretProviderAlias } from "coreblow/plugin-sdk/provider-auth";
import {
  normalizeSecretInputString,
  normalizeResolvedSecretInputString,
  resolveSecretInputString,
} from "coreblow/plugin-sdk/secret-input";
import { normalizeOptionalString } from "coreblow/plugin-sdk/string-coerce-runtime";
import type { ClickClackAccountConfig, CoreConfig, ResolvedClickClackAccount } from "./types.js";

const DEFAULT_RECONNECT_MS = 1_500;

function hasImplicitDefaultClickClackAccount(cfg: CoreConfig): boolean {
  const channel = cfg.channels?.clickclack;
  return Boolean(
    channel?.baseUrl?.trim() &&
      (typeof channel.token === "string" ? channel.token.trim() : channel.token) &&
      channel.workspace?.trim(),
  );
}

export function listClickClackAccountIds(cfg: CoreConfig): string[] {
  const ids = new Set<string>();
  if (hasImplicitDefaultClickClackAccount(cfg)) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }
  for (const accountId of Object.keys(cfg.channels?.clickclack?.accounts ?? {})) {
    ids.add(normalizeAccountId(accountId));
  }
  return [...ids].toSorted((left, right) => {
    if (left === DEFAULT_ACCOUNT_ID) {
      return -1;
    }
    if (right === DEFAULT_ACCOUNT_ID) {
      return 1;
    }
    return left.localeCompare(right);
  });
}

export function resolveDefaultClickClackAccountId(cfg: CoreConfig): string {
  if (cfg.channels?.clickclack?.defaultAccount) {
    return normalizeAccountId(cfg.channels.clickclack.defaultAccount);
  }
  const ids = listClickClackAccountIds(cfg);
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

export { DEFAULT_ACCOUNT_ID };

function resolveMergedClickClackAccountConfig(
  cfg: CoreConfig,
  accountId: string,
): ClickClackAccountConfig {
  return resolveMergedAccountConfig<ClickClackAccountConfig>({
    channelConfig: cfg.channels?.clickclack as ClickClackAccountConfig | undefined,
    accounts: cfg.channels?.clickclack?.accounts,
    accountId,
    omitKeys: ["defaultAccount"],
    normalizeAccountId,
  });
}

function resolveClickClackToken(params: {
  cfg: CoreConfig;
  value: unknown;
  accountId: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const resolved = resolveSecretInputString({
    value: params.value,
    path:
      params.accountId === DEFAULT_ACCOUNT_ID
        ? "channels.clickclack.token"
        : `channels.clickclack.accounts.${params.accountId}.token`,
    defaults: params.cfg.secrets?.defaults,
    mode: "inspect",
  });
  if (resolved.status !== "available") {
    if (resolved.status === "configured_unavailable" && resolved.ref.source === "env") {
      const providerConfig = params.cfg.secrets?.providers?.[resolved.ref.provider];
      if (providerConfig) {
        if (providerConfig.source !== "env") {
          throw new Error(
            `Secret provider "${resolved.ref.provider}" has source "${providerConfig.source}" but ref requests "env".`,
          );
        }
        if (providerConfig.allowlist && !providerConfig.allowlist.includes(resolved.ref.id)) {
          throw new Error(
            `Environment variable "${resolved.ref.id}" is not allowlisted in secrets.providers.${resolved.ref.provider}.allowlist.`,
          );
        }
      } else if (
        resolved.ref.provider !==
        resolveDefaultSecretProviderAlias({ secrets: params.cfg.secrets }, "env")
      ) {
        throw new Error(
          `Secret provider "${resolved.ref.provider}" is not configured (ref: env:${resolved.ref.provider}:${resolved.ref.id}).`,
        );
      }
      return normalizeSecretInputString((params.env ?? process.env)[resolved.ref.id]) ?? "";
    }
    return "";
  }
  return (
    normalizeResolvedSecretInputString({
      value: resolved.value,
      path: "channels.clickclack.token",
    }) ?? ""
  );
}

export function resolveClickClackAccount(params: {
  cfg: CoreConfig;
  accountId?: string | null;
  env?: NodeJS.ProcessEnv;
}): ResolvedClickClackAccount {
  const accountId = normalizeAccountId(params.accountId);
  const merged = resolveMergedClickClackAccountConfig(params.cfg, accountId);
  const baseEnabled = params.cfg.channels?.clickclack?.enabled !== false;
  const enabled = baseEnabled && merged.enabled !== false;
  const baseUrl = merged.baseUrl?.trim().replace(/\/$/, "") ?? "";
  const token = resolveClickClackToken({
    cfg: params.cfg,
    value: merged.token,
    accountId,
    env: params.env,
  });
  const workspace = merged.workspace?.trim() ?? "";
  return {
    accountId,
    enabled,
    configured: Boolean(baseUrl && token && workspace),
    name: normalizeOptionalString(merged.name),
    baseUrl,
    token,
    workspace,
    botUserId: normalizeOptionalString(merged.botUserId),
    agentId: normalizeOptionalString(merged.agentId),
    replyMode: merged.replyMode === "model" ? "model" : "agent",
    model: normalizeOptionalString(merged.model),
    systemPrompt: normalizeOptionalString(merged.systemPrompt),
    timeoutSeconds: merged.timeoutSeconds,
    toolsAllow: merged.toolsAllow,
    senderIsOwner: merged.senderIsOwner === true,
    defaultTo: merged.defaultTo?.trim() || "channel:general",
    allowFrom: merged.allowFrom ?? ["*"],
    reconnectMs: merged.reconnectMs ?? DEFAULT_RECONNECT_MS,
    config: {
      ...merged,
      allowFrom: merged.allowFrom ?? ["*"],
    },
  };
}

export function listEnabledClickClackAccounts(cfg: CoreConfig): ResolvedClickClackAccount[] {
  return listClickClackAccountIds(cfg)
    .map((accountId) => resolveClickClackAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
