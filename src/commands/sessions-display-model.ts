import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import {
  inferUniqueProviderFromConfiguredModels,
  isCliProvider,
} from "../agents/model-selection.js";
import { resolveAgentModelPrimaryValue } from "../config/model-input.js";
import type { CoreBlowConfig } from "../config/types.coreblow.js";

type SessionDisplayModelRow = {
  key: string;
  model?: string;
  modelProvider?: string;
  modelOverride?: string;
  providerOverride?: string;
};

type SessionDisplayDefaults = {
  model: string;
};

type SessionDisplayModelRef = { provider: string; model: string };

function parseModelRef(raw: string, defaultProvider: string): SessionDisplayModelRef {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { provider: defaultProvider, model: DEFAULT_MODEL };
  }
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) {
    return { provider: defaultProvider, model: trimmed };
  }
  return {
    provider: trimmed.slice(0, slashIndex).trim() || defaultProvider,
    model: trimmed.slice(slashIndex + 1).trim() || DEFAULT_MODEL,
  };
}

function resolveAgentPrimaryModel(
  cfg: CoreBlowConfig,
  agentId: string | undefined,
): string | undefined {
  if (!agentId) {
    return undefined;
  }
  const agentConfig = cfg.agents?.list?.find((agent) => agent.id === agentId);
  return resolveAgentModelPrimaryValue(agentConfig?.model);
}

function normalizeStoredOverrideModel(params: {
  providerOverride?: string;
  modelOverride?: string;
  defaultProvider: string;
}): SessionDisplayModelRef {
  const provider = params.providerOverride?.trim() || params.defaultProvider;
  const model = params.modelOverride?.trim() || DEFAULT_MODEL;
  return { provider, model };
}

export function resolveSessionDisplayModel(params: {
  row: SessionDisplayModelRow;
  cfg: CoreBlowConfig;
  defaults: SessionDisplayDefaults;
}): SessionDisplayModelRef {
  const { row, cfg, defaults } = params;
  const defaultProvider =
    inferUniqueProviderFromConfiguredModels({ cfg, model: row.model ?? defaults.model }) ?? DEFAULT_PROVIDER;

  if (row.modelOverride || row.providerOverride) {
    return normalizeStoredOverrideModel({
      providerOverride: row.providerOverride,
      modelOverride: row.modelOverride,
      defaultProvider,
    });
  }

  if (row.model) {
    const parsed = parseModelRef(row.model, defaultProvider);
    if (!isCliProvider(parsed.provider)) {
      return parsed;
    }
  }

  const agentPrimary = resolveAgentPrimaryModel(cfg, row.key.split(":")[1]);
  if (agentPrimary) {
    return parseModelRef(agentPrimary, defaultProvider);
  }

  return parseModelRef(defaults.model, defaultProvider);
}
