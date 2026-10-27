import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";
import { normalizeEmbeddedAgentRuntime } from "./pi-embedded-runner/runtime.js";
import { normalizeProviderId } from "./provider-id.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeRuntimeId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const lower = normalizeOptionalLowercaseString(value);
  if (!lower) {
    return undefined;
  }
  return normalizeOptionalLowercaseString(normalizeEmbeddedAgentRuntime(lower));
}

function listAgentModelRefs(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (!isRecord(value)) {
    return [];
  }
  const refs: string[] = [];
  if (typeof value.primary === "string") {
    refs.push(value.primary);
  }
  if (Array.isArray(value.fallbacks)) {
    for (const fallback of value.fallbacks) {
      if (typeof fallback === "string") {
        refs.push(fallback);
      }
    }
  }
  return refs;
}

function pushAgentModelRefs(refs: string[], value: unknown): void {
  for (const ref of listAgentModelRefs(value)) {
    refs.push(ref);
  }
}

function parseConfiguredModelRef(
  value: unknown,
): { provider: string; modelId: string } | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash >= trimmed.length - 1) {
    return undefined;
  }
  return {
    provider: normalizeProviderId(trimmed.slice(0, slash)),
    modelId: trimmed.slice(slash + 1).trim(),
  };
}

function pushConfiguredModelRuntimeIds(config: CoreBlowConfig, runtimes: Set<string>): void {
  for (const providerConfig of Object.values(config.models?.providers ?? {})) {
    const providerRuntime = normalizeRuntimeId(
      (providerConfig as { agentRuntime?: { id?: string } })?.agentRuntime?.id,
    );
    if (providerRuntime && providerRuntime !== "auto" && providerRuntime !== "pi") {
      runtimes.add(providerRuntime);
    }
    for (const modelConfig of providerConfig?.models ?? []) {
      const modelRuntime = normalizeRuntimeId(
        (modelConfig as { agentRuntime?: { id?: string } })?.agentRuntime?.id,
      );
      if (modelRuntime && modelRuntime !== "auto" && modelRuntime !== "pi") {
        runtimes.add(modelRuntime);
      }
    }
  }
  const pushModelMapRuntimeIds = (models: unknown) => {
    if (!isRecord(models)) {
      return;
    }
    for (const entry of Object.values(models)) {
      if (!isRecord(entry)) {
        continue;
      }
      const runtime = normalizeRuntimeId(
        isRecord(entry.agentRuntime) ? entry.agentRuntime.id : undefined,
      );
      if (runtime && runtime !== "auto" && runtime !== "pi") {
        runtimes.add(runtime);
      }
    }
  };
  pushModelMapRuntimeIds(config.agents?.defaults?.models);
  const agents = Array.isArray(config.agents?.list) ? config.agents.list : [];
  for (const agent of agents) {
    pushModelMapRuntimeIds(isRecord(agent) ? (agent as { models?: unknown }).models : undefined);
  }
}

function pushConfiguredAgentModelRuntimeIds(
  config: CoreBlowConfig,
  runtimes: Set<string>,
): void {
  const pushModelRefs = (modelRefs: string[]) => {
    for (const modelRef of modelRefs) {
      const parsed = parseConfiguredModelRef(modelRef);
      if (parsed) {
        // If provider specifies codex, add it
        if (parsed.provider === "openai-codex" || parsed.provider === "codex") {
          runtimes.add("codex");
        }
      }
    }
  };
  const pushModelMapRefs = (models: unknown) => {
    if (!isRecord(models)) {
      return;
    }
    pushModelRefs(Object.keys(models));
  };

  const defaultsModel = config.agents?.defaults?.model;
  const defaultsModelRefs: string[] = [];
  pushAgentModelRefs(defaultsModelRefs, defaultsModel);
  pushModelRefs(defaultsModelRefs);
  pushModelMapRefs(config.agents?.defaults?.models);

  if (!Array.isArray(config.agents?.list)) {
    return;
  }
  for (const agent of config.agents.list) {
    if (!isRecord(agent)) {
      continue;
    }
    const selectedModelRefs: string[] = [];
    pushAgentModelRefs(selectedModelRefs, agent.model ?? defaultsModel);
    pushModelRefs(selectedModelRefs);
    pushModelMapRefs((agent as { models?: unknown }).models);
  }
}

function pushLegacyAgentRuntimeIds(config: CoreBlowConfig, runtimes: Set<string>): void {
  const pushRuntimeId = (value: unknown) => {
    const runtime = normalizeRuntimeId(value);
    if (runtime && runtime !== "auto" && runtime !== "pi") {
      runtimes.add(runtime);
    }
  };

  pushRuntimeId((config.agents?.defaults as { agentRuntime?: { id?: string } })?.agentRuntime?.id);
  const agents = Array.isArray(config.agents?.list) ? config.agents.list : [];
  for (const agent of agents) {
    pushRuntimeId((agent as { agentRuntime?: { id?: string } }).agentRuntime?.id);
  }
}

export type ConfiguredAgentHarnessRuntimeOptions = {
  includeEnvRuntime?: boolean;
  includeImplicitRuntimePreferences?: boolean;
  includeLegacyAgentRuntimes?: boolean;
};

export class AgentHarnessRuntimeCollector {
  public static collectConfiguredAgentHarnessRuntimes(
    config: CoreBlowConfig,
    env: NodeJS.ProcessEnv,
    options: ConfiguredAgentHarnessRuntimeOptions = {},
  ): string[] {
    const runtimes = new Set<string>();
    const includeEnvRuntime = options.includeEnvRuntime ?? true;
    const includeLegacyAgentRuntimes = options.includeLegacyAgentRuntimes ?? true;

    if (includeEnvRuntime) {
      const envRuntime = normalizeRuntimeId(
        env.COREBLOW_AGENT_RUNTIME || env.OPENCLAW_AGENT_RUNTIME,
      );
      if (envRuntime && envRuntime !== "auto" && envRuntime !== "pi") {
        runtimes.add(envRuntime);
      }
    }
    pushConfiguredModelRuntimeIds(config, runtimes);
    if (includeLegacyAgentRuntimes) {
      pushLegacyAgentRuntimeIds(config, runtimes);
    }
    pushConfiguredAgentModelRuntimeIds(config, runtimes);

    return [...runtimes].toSorted((left, right) => left.localeCompare(right));
  }
}

export function collectConfiguredAgentHarnessRuntimes(
  config: CoreBlowConfig,
  env: NodeJS.ProcessEnv,
  options: ConfiguredAgentHarnessRuntimeOptions = {},
): string[] {
  return AgentHarnessRuntimeCollector.collectConfiguredAgentHarnessRuntimes(
    config,
    env,
    options,
  );
}
