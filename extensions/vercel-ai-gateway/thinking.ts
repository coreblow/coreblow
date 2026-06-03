import { matchesExactOrPrefix } from "coreblow/plugin-sdk/provider-model-shared";

const UPSTREAM_OPENAI_PREFIX = "openai/";
const UPSTREAM_ANTHROPIC_PREFIX = "anthropic/";

const VERCEL_OPENAI_XHIGH_MODEL_IDS = [
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-5.3-codex",
  "gpt-5.2",
  "gpt-5.2-codex",
  "gpt-5.1-codex",
] as const;

const CLAUDE_ADAPTIVE_PREFIXES = [
  "claude-opus-4-6",
  "claude-opus-4.6",
  "claude-sonnet-4-6",
  "claude-sonnet-4.6",
  "claude-opus-4-5",
  "claude-opus-4.5",
  "claude-sonnet-4-5",
  "claude-sonnet-4.5",
  "claude-haiku-4-5",
  "claude-haiku-4.5",
] as const;

function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function stripTrustedUpstreamPrefix(modelId: string, prefix: string): string | null {
  const normalized = normalizeLowercaseStringOrEmpty(modelId);
  if (!normalized.startsWith(prefix)) {
    return null;
  }
  const upstreamModelId = normalized.slice(prefix.length).trim();
  return upstreamModelId || null;
}

export function resolveVercelAiGatewaySupportsXHighThinking(modelId: string): boolean | undefined {
  const openAiModelId = stripTrustedUpstreamPrefix(modelId, UPSTREAM_OPENAI_PREFIX);
  if (!openAiModelId) {
    return undefined;
  }
  return matchesExactOrPrefix(openAiModelId, VERCEL_OPENAI_XHIGH_MODEL_IDS) || undefined;
}

export function resolveVercelAiGatewayDefaultThinkingLevel(
  modelId: string,
): "adaptive" | undefined {
  const anthropicModelId = stripTrustedUpstreamPrefix(modelId, UPSTREAM_ANTHROPIC_PREFIX);
  if (!anthropicModelId) {
    return undefined;
  }
  return matchesExactOrPrefix(anthropicModelId, CLAUDE_ADAPTIVE_PREFIXES) ? "adaptive" : undefined;
}
