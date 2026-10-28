import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { resolveAgentExecutionContract, resolveSessionAgentIds } from "./agent-scope.js";

/**
 * Strip any leading `provider/` or `provider:` prefix from a model id so the
 * bare-name regex matching below works against `openai/gpt-5.4` and
 * `openai:gpt-5.4` the same way it does against `gpt-5.4`. Returns the bare
 * model id lowercased for comparison.
 */
export function stripProviderPrefix(modelId: string): string {
  const normalizedModelId = modelId.trim();
  const match = /^([^/:]+)[/:](.+)$/.exec(normalizedModelId);
  return (match?.[2] ?? normalizedModelId).toLowerCase();
}

/**
 * Regex that matches the full set of GPT-5 variants the strict-agentic
 * contract should auto-activate for. Intentionally permissive: every
 * model id in the gpt-5 family should opt in by default, not just the
 * canonical `gpt-5.4`.
 */
const STRICT_AGENTIC_MODEL_ID_PATTERN = /^gpt-5(?:[.o-]|$)/i;

/**
 * Supported provider + model combinations where strict-agentic is the intended
 * runtime contract.
 */
export function isStrictAgenticSupportedProviderModel(params: {
  provider?: string | null;
  modelId?: string | null;
}): boolean {
  const provider = normalizeLowercaseStringOrEmpty(params.provider ?? "");
  if (provider !== "openai" && provider !== "openai-codex" && provider !== "mock-openai") {
    return false;
  }
  const modelId = typeof params.modelId === "string" ? params.modelId : "";
  const bareModelId = stripProviderPrefix(modelId);
  return STRICT_AGENTIC_MODEL_ID_PATTERN.test(bareModelId);
}

/**
 * Returns the effective execution contract for an embedded Pi run.
 */
export function resolveEffectiveExecutionContract(params: {
  config?: CoreBlowConfig;
  sessionKey?: string;
  agentId?: string | null;
  provider?: string | null;
  modelId?: string | null;
}): "default" | "strict-agentic" {
  const { sessionAgentId } = resolveSessionAgentIds({
    sessionKey: params.sessionKey,
    config: params.config,
    agentId: params.agentId ?? undefined,
  });
  const explicit = resolveAgentExecutionContract(params.config, sessionAgentId);
  const supported = isStrictAgenticSupportedProviderModel({
    provider: params.provider,
    modelId: params.modelId,
  });
  if (!supported) {
    return "default";
  }
  if (explicit === "default") {
    return "default";
  }
  return "strict-agentic";
}

export function isStrictAgenticExecutionContractActive(params: {
  config?: CoreBlowConfig;
  sessionKey?: string;
  agentId?: string | null;
  provider?: string | null;
  modelId?: string | null;
}): boolean {
  return resolveEffectiveExecutionContract(params) === "strict-agentic";
}
