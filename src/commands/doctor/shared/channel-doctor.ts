import {
  getBundledChannelPlugin,
  getBundledChannelSetupPlugin,
} from "../../../channels/plugins/bundled.js";
import { resolveReadOnlyChannelPluginsForConfig } from "../../../channels/plugins/read-only.js";
import { getLoadedChannelPlugin } from "../../../channels/plugins/registry.js";
import type {
  ChannelDoctorAdapter,
  ChannelDoctorConfigMutation,
  ChannelDoctorEmptyAllowlistAccountContext,
  ChannelDoctorSequenceResult,
} from "../../../channels/plugins/types.adapters.js";
import type { CoreBlowConfig } from "../../../config/config.js";
import { normalizeOptionalLowercaseString } from "../../../shared/string-coerce.js";

type ChannelDoctorEntry = {
  doctor: ChannelDoctorAdapter;
};

type ChannelDoctorPluginCandidate = {
  id: string;
  doctor?: ChannelDoctorAdapter;
};

type ChannelDoctorLookupContext = {
  cfg: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
};

type ChannelDoctorEmptyAllowlistLookupParams = ChannelDoctorEmptyAllowlistAccountContext & {
  cfg?: CoreBlowConfig;
};

const channelDoctorFunctionKeys = new Set<keyof ChannelDoctorAdapter>([
  "normalizeCompatibilityConfig",
  "collectPreviewWarnings",
  "collectMutableAllowlistWarnings",
  "repairConfig",
  "runConfigSequence",
  "cleanStaleConfig",
  "collectEmptyAllowlistExtraWarnings",
  "shouldSkipDefaultEmptyGroupAllowlistWarning",
]);

const channelDoctorBooleanKeys = new Set<keyof ChannelDoctorAdapter>([
  "groupAllowFromFallbackToAllowFrom",
  "warnOnEmptyGroupSenderAllowlist",
]);

const channelDoctorEnumValues: Partial<Record<keyof ChannelDoctorAdapter, ReadonlySet<string>>> = {
  dmAllowFromMode: new Set(["topOnly", "topOrNested", "nestedOnly"]),
  groupModel: new Set(["sender", "route", "hybrid"]),
};

export type ChannelDoctorEmptyAllowlistPolicyHooks = {
  extraWarningsForAccount: (params: ChannelDoctorEmptyAllowlistAccountContext) => string[];
  shouldSkipDefaultEmptyGroupAllowlistWarning: (
    params: ChannelDoctorEmptyAllowlistAccountContext,
  ) => boolean;
};

function collectConfiguredChannelIds(cfg: CoreBlowConfig): string[] {
  if (cfg.plugins?.enabled === false) {
    return [];
  }
  const channels =
    cfg.channels && typeof cfg.channels === "object" && !Array.isArray(cfg.channels)
      ? cfg.channels
      : null;
  if (!channels) {
    return [];
  }
  const channelEntries = channels as Record<string, unknown>;
  return Object.keys(channels)
    .filter((channelId) => {
      if (channelId === "defaults") {
        return false;
      }
      if (isChannelDoctorBlockedByConfig(channelId, cfg)) {
        return false;
      }
      const entry = channelEntries[channelId];
      return (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry) ||
        (entry as { enabled?: unknown }).enabled !== false
      );
    })
    .toSorted();
}

function isChannelDoctorBlockedByConfig(channelId: string, cfg: CoreBlowConfig): boolean {
  if (cfg.plugins?.enabled === false) {
    return true;
  }
  const normalizedChannelId = normalizeOptionalLowercaseString(channelId) ?? channelId;
  if (cfg.plugins?.entries?.[normalizedChannelId]?.enabled === false) {
    return true;
  }
  const channelEntry = (cfg.channels as Record<string, unknown> | undefined)?.[normalizedChannelId];
  return (
    Boolean(channelEntry && typeof channelEntry === "object" && !Array.isArray(channelEntry)) &&
    (channelEntry as { enabled?: unknown }).enabled === false
  );
}

function safeGetLoadedChannelPlugin(id: string) {
  try {
    return getLoadedChannelPlugin(id);
  } catch {
    return undefined;
  }
}

function safeGetBundledChannelSetupPlugin(id: string) {
  try {
    return getBundledChannelSetupPlugin(id);
  } catch {
    return undefined;
  }
}

function safeGetBundledChannelPlugin(id: string) {
  try {
    return getBundledChannelPlugin(id);
  } catch {
    return undefined;
  }
}

function safeListReadOnlyChannelPlugins(context: ChannelDoctorLookupContext) {
  try {
    return resolveReadOnlyChannelPluginsForConfig(context.cfg, {
      ...(context.env ? { env: context.env } : {}),
      includePersistedAuthState: false,
      includeSetupFallbackPlugins: true,
    }).plugins;
  } catch {
    return [];
  }
}

function listReadOnlyChannelPluginsById(
  context: ChannelDoctorLookupContext,
): Map<string, ChannelDoctorPluginCandidate> {
  return new Map(safeListReadOnlyChannelPlugins(context).map((plugin) => [plugin.id, plugin]));
}

function mergeDoctorAdapters(
  adapters: Array<ChannelDoctorAdapter | undefined>,
): ChannelDoctorAdapter | undefined {
  const merged: Partial<Record<keyof ChannelDoctorAdapter, unknown>> = {};
  for (const adapter of adapters) {
    if (!adapter) {
      continue;
    }
    for (const [key, value] of Object.entries(adapter) as Array<
      [keyof ChannelDoctorAdapter, unknown]
    >) {
      if (value === undefined || key in merged) {
        continue;
      }
      if (channelDoctorFunctionKeys.has(key)) {
        if (typeof value === "function") {
          merged[key] = value;
        }
        continue;
      }
      if (channelDoctorBooleanKeys.has(key)) {
        if (typeof value === "boolean") {
          merged[key] = value;
        }
        continue;
      }
      const allowedEnumValues = channelDoctorEnumValues[key];
      if (allowedEnumValues && typeof value === "string" && allowedEnumValues.has(value)) {
        merged[key] = value;
      }
    }
  }
  return Object.keys(merged).length > 0 ? (merged as ChannelDoctorAdapter) : undefined;
}

function resolveDoctorForPluginCandidate(
  plugin: ChannelDoctorPluginCandidate | undefined,
): ChannelDoctorAdapter | undefined {
  if (!plugin) {
    return undefined;
  }
  return mergeDoctorAdapters([
    plugin.doctor,
    safeGetLoadedChannelPlugin(plugin.id)?.doctor,
    safeGetBundledChannelSetupPlugin(plugin.id)?.doctor,
    safeGetBundledChannelPlugin(plugin.id)?.doctor,
  ]);
}

function resolveChannelDoctorForId(
  channelId: string,
  context: ChannelDoctorLookupContext,
  readOnlyPluginsById: Map<string, ChannelDoctorPluginCandidate>,
): ChannelDoctorAdapter | undefined {
  const directCandidate = readOnlyPluginsById.get(channelId);
  if (directCandidate) {
    return resolveDoctorForPluginCandidate(directCandidate);
  }
  const normalizedChannelId = normalizeOptionalLowercaseString(channelId) ?? channelId;
  const normalizedCandidate = readOnlyPluginsById.get(normalizedChannelId);
  if (normalizedCandidate) {
    return resolveDoctorForPluginCandidate(normalizedCandidate);
  }
  return mergeDoctorAdapters([
    safeGetLoadedChannelPlugin(normalizedChannelId)?.doctor,
    safeGetLoadedChannelPlugin(channelId)?.doctor,
    safeGetBundledChannelSetupPlugin(normalizedChannelId)?.doctor,
    safeGetBundledChannelSetupPlugin(channelId)?.doctor,
    safeGetBundledChannelPlugin(normalizedChannelId)?.doctor,
    safeGetBundledChannelPlugin(channelId)?.doctor,
    safeListReadOnlyChannelPlugins(context).find((plugin) => plugin.id === normalizedChannelId)
      ?.doctor,
  ]);
}

export function listChannelDoctorEntries(
  channelIds: readonly string[],
  context: ChannelDoctorLookupContext,
): ChannelDoctorEntry[] {
  const uniqueChannelIds = [...new Set(channelIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueChannelIds.length === 0) {
    return [];
  }
  const readOnlyPluginsById = listReadOnlyChannelPluginsById(context);
  const entries: ChannelDoctorEntry[] = [];
  for (const channelId of uniqueChannelIds) {
    if (isChannelDoctorBlockedByConfig(channelId, context.cfg)) {
      continue;
    }
    const doctor = resolveChannelDoctorForId(channelId, context, readOnlyPluginsById);
    if (!doctor) {
      continue;
    }
    entries.push({ doctor });
  }
  return entries;
}

export function resolveChannelDoctorForChannel(
  channelName: string,
  context: ChannelDoctorLookupContext,
): ChannelDoctorAdapter | undefined {
  return listChannelDoctorEntries([channelName], context)[0]?.doctor;
}

function collectEmptyAllowlistExtraWarningsForEntries(
  entries: readonly ChannelDoctorEntry[],
  params: ChannelDoctorEmptyAllowlistAccountContext,
): string[] {
  const { channelName, account, prefix } = params;
  const hookParams = { channelName, account, prefix };
  const warnings: string[] = [];
  for (const entry of entries) {
    const lines = entry.doctor.collectEmptyAllowlistExtraWarnings?.(hookParams);
    if (lines?.length) {
      warnings.push(...lines);
    }
  }
  return warnings;
}

function shouldSkipDefaultEmptyGroupAllowlistWarningForEntries(
  entries: readonly ChannelDoctorEntry[],
  params: ChannelDoctorEmptyAllowlistAccountContext,
): boolean {
  const { channelName, account, prefix } = params;
  const hookParams = { channelName, account, prefix };
  for (const entry of entries) {
    if (entry.doctor.shouldSkipDefaultEmptyGroupAllowlistWarning?.(hookParams)) {
      return true;
    }
  }
  return false;
}

export function createChannelDoctorEmptyAllowlistPolicyHooks(
  context: ChannelDoctorLookupContext,
): ChannelDoctorEmptyAllowlistPolicyHooks {
  const readOnlyPluginsById = listReadOnlyChannelPluginsById(context);
  const cachedEntriesByChannel = new Map<string, ChannelDoctorEntry[]>();
  const entriesForChannel = (channelName: string) => {
    const cached = cachedEntriesByChannel.get(channelName);
    if (cached) {
      return cached;
    }
    const entries: ChannelDoctorEntry[] = [];
    if (!isChannelDoctorBlockedByConfig(channelName, context.cfg)) {
      const doctor = resolveChannelDoctorForId(channelName, context, readOnlyPluginsById);
      if (doctor) {
        entries.push({ doctor });
      }
    }
    cachedEntriesByChannel.set(channelName, entries);
    return entries;
  };
  return {
    extraWarningsForAccount: (params) =>
      collectEmptyAllowlistExtraWarningsForEntries(entriesForChannel(params.channelName), params),
    shouldSkipDefaultEmptyGroupAllowlistWarning: (params) =>
      shouldSkipDefaultEmptyGroupAllowlistWarningForEntries(
        entriesForChannel(params.channelName),
        params,
      ),
  };
}

export async function runChannelDoctorConfigSequences(params: {
  cfg: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  shouldRepair: boolean;
}): Promise<ChannelDoctorSequenceResult> {
  const changeNotes: string[] = [];
  const warningNotes: string[] = [];
  for (const entry of listChannelDoctorEntries(collectConfiguredChannelIds(params.cfg), {
    cfg: params.cfg,
    env: params.env,
  })) {
    const result = await entry.doctor.runConfigSequence?.(params);
    if (!result) {
      continue;
    }
    changeNotes.push(...result.changeNotes);
    warningNotes.push(...result.warningNotes);
  }
  return { changeNotes, warningNotes };
}

export function collectChannelDoctorCompatibilityMutations(
  cfg: CoreBlowConfig,
  options: { env?: NodeJS.ProcessEnv } = {},
): ChannelDoctorConfigMutation[] {
  const channelIds = collectConfiguredChannelIds(cfg);
  if (channelIds.length === 0) {
    return [];
  }
  const mutations: ChannelDoctorConfigMutation[] = [];
  let nextCfg = cfg;
  for (const entry of listChannelDoctorEntries(channelIds, { cfg, env: options.env })) {
    const mutation = entry.doctor.normalizeCompatibilityConfig?.({ cfg: nextCfg });
    if (!mutation || mutation.changes.length === 0) {
      continue;
    }
    mutations.push(mutation);
    nextCfg = mutation.config;
  }
  return mutations;
}

export async function collectChannelDoctorStaleConfigMutations(
  cfg: CoreBlowConfig,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<ChannelDoctorConfigMutation[]> {
  const mutations: ChannelDoctorConfigMutation[] = [];
  let nextCfg = cfg;
  for (const entry of listChannelDoctorEntries(collectConfiguredChannelIds(cfg), {
    cfg,
    env: options.env,
  })) {
    const mutation = await entry.doctor.cleanStaleConfig?.({ cfg: nextCfg });
    if (!mutation || mutation.changes.length === 0) {
      continue;
    }
    mutations.push(mutation);
    nextCfg = mutation.config;
  }
  return mutations;
}

export async function collectChannelDoctorPreviewWarnings(params: {
  cfg: CoreBlowConfig;
  doctorFixCommand: string;
  env?: NodeJS.ProcessEnv;
}): Promise<string[]> {
  const warnings: string[] = [];
  for (const entry of listChannelDoctorEntries(collectConfiguredChannelIds(params.cfg), {
    cfg: params.cfg,
    env: params.env,
  })) {
    const lines = await entry.doctor.collectPreviewWarnings?.(params);
    if (lines?.length) {
      warnings.push(...lines);
    }
  }
  return warnings;
}

export async function collectChannelDoctorMutableAllowlistWarnings(params: {
  cfg: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<string[]> {
  const warnings: string[] = [];
  for (const entry of listChannelDoctorEntries(collectConfiguredChannelIds(params.cfg), {
    cfg: params.cfg,
    env: params.env,
  })) {
    const lines = await entry.doctor.collectMutableAllowlistWarnings?.(params);
    if (lines?.length) {
      warnings.push(...lines);
    }
  }
  return warnings;
}

export async function collectChannelDoctorRepairMutations(params: {
  cfg: CoreBlowConfig;
  doctorFixCommand: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ChannelDoctorConfigMutation[]> {
  const mutations: ChannelDoctorConfigMutation[] = [];
  let nextCfg = params.cfg;
  for (const entry of listChannelDoctorEntries(collectConfiguredChannelIds(params.cfg), {
    cfg: params.cfg,
    env: params.env,
  })) {
    const mutation = await entry.doctor.repairConfig?.({
      cfg: nextCfg,
      doctorFixCommand: params.doctorFixCommand,
    });
    if (!mutation || mutation.changes.length === 0) {
      if (mutation?.warnings?.length) {
        mutations.push({ config: nextCfg, changes: [], warnings: mutation.warnings });
      }
      continue;
    }
    mutations.push(mutation);
    nextCfg = mutation.config;
  }
  return mutations;
}

export function collectChannelDoctorEmptyAllowlistExtraWarnings(
  params: ChannelDoctorEmptyAllowlistLookupParams,
): string[] {
  return collectEmptyAllowlistExtraWarningsForEntries(
    listChannelDoctorEntries([params.channelName], {
      cfg: params.cfg ?? {},
    }),
    params,
  );
}

export function shouldSkipChannelDoctorDefaultEmptyGroupAllowlistWarning(
  params: ChannelDoctorEmptyAllowlistLookupParams,
): boolean {
  return shouldSkipDefaultEmptyGroupAllowlistWarningForEntries(
    listChannelDoctorEntries([params.channelName], {
      cfg: params.cfg ?? {},
    }),
    params,
  );
}
