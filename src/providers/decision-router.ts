// ============================================================================
// CoreBlow Pure DOP Adaptive Decision & Quota-Window Router
// ============================================================================

/**
 * Pure Data-Oriented Programming (DOP) contracts, deterministic task
 * classification, agent profile routing, and Daybreak failover switching
 * when provider token quota windows are exhausted or in cooldown.
 */

// ---------------------------------------------------------------------------
// Pure DOP Route & Quota Contracts
// ---------------------------------------------------------------------------

export type SubagentRouteTier =
  | "fast"
  | "deep"
  | "local"
  | "coding"
  | "vision"
  | "decision";

export interface AgentProfileRoute {
  readonly profileId: string;
  readonly displayName: string;
  readonly preferredTier: SubagentRouteTier;
  readonly providerId: string;
  readonly modelId: string;
  readonly fallbackProviderId?: string;
  readonly fallbackModelId?: string;
  readonly skillIds: readonly string[];
}

export interface UsageWindowGauge {
  readonly providerId: string;
  readonly windowLimitTokens: number;
  readonly usedTokens: number;
  readonly windowResetsAtMs: number;
  readonly cooldownUntilMs?: number;
}

export interface AdaptiveModelRouteDecision {
  readonly providerId: string;
  readonly modelId: string;
  readonly tier: SubagentRouteTier;
  readonly daybreakSwitched: boolean;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Built-in Pure DOP Default Tier Routes & Profiles
// ---------------------------------------------------------------------------

export const DEFAULT_TIER_ROUTES: Readonly<
  Record<
    SubagentRouteTier,
    {
      readonly providerId: string;
      readonly modelId: string;
      readonly fallbackProviderId: string;
      readonly fallbackModelId: string;
    }
  >
> = Object.freeze({
  decision: Object.freeze({
    providerId: "groq",
    modelId: "llama-3.3-70b-versatile",
    fallbackProviderId: "openai",
    fallbackModelId: "gpt-4o-mini",
  }),
  fast: Object.freeze({
    providerId: "groq",
    modelId: "llama-3.3-70b-versatile",
    fallbackProviderId: "openai",
    fallbackModelId: "gpt-4o-mini",
  }),
  coding: Object.freeze({
    providerId: "deepseek",
    modelId: "deepseek-chat",
    fallbackProviderId: "ollama",
    fallbackModelId: "qwen2.5-coder",
  }),
  deep: Object.freeze({
    providerId: "deepseek",
    modelId: "deepseek-reasoner",
    fallbackProviderId: "openai",
    fallbackModelId: "o3-mini",
  }),
  local: Object.freeze({
    providerId: "ollama",
    modelId: "llama3.3",
    fallbackProviderId: "vllm",
    fallbackModelId: "default",
  }),
  vision: Object.freeze({
    providerId: "openai",
    modelId: "gpt-4o",
    fallbackProviderId: "google",
    fallbackModelId: "gemini-2.5-flash",
  }),
});

export const DEFAULT_AGENT_PROFILE_ROUTES: readonly AgentProfileRoute[] = Object.freeze([
  Object.freeze({
    profileId: "lead",
    displayName: "Lead Orchestrator",
    preferredTier: "deep",
    providerId: "anthropic",
    modelId: "claude-3-7-sonnet",
    fallbackProviderId: "openai",
    fallbackModelId: "gpt-4o",
    skillIds: Object.freeze([]),
  }),
  Object.freeze({
    profileId: "coder",
    displayName: "Specialist Coder",
    preferredTier: "coding",
    providerId: "deepseek",
    modelId: "deepseek-chat",
    fallbackProviderId: "ollama",
    fallbackModelId: "qwen2.5-coder",
    skillIds: Object.freeze([]),
  }),
  Object.freeze({
    profileId: "researcher",
    displayName: "Deep Researcher",
    preferredTier: "deep",
    providerId: "deepseek",
    modelId: "deepseek-reasoner",
    fallbackProviderId: "openai",
    fallbackModelId: "o3-mini",
    skillIds: Object.freeze([]),
  }),
  Object.freeze({
    profileId: "auditor",
    displayName: "Security & Systems Auditor",
    preferredTier: "deep",
    providerId: "anthropic",
    modelId: "claude-3-7-sonnet",
    fallbackProviderId: "ollama",
    fallbackModelId: "llama3.3",
    skillIds: Object.freeze([]),
  }),
  Object.freeze({
    profileId: "verifier",
    displayName: "Verification Sentinel",
    preferredTier: "fast",
    providerId: "groq",
    modelId: "llama-3.3-70b-versatile",
    fallbackProviderId: "openai",
    fallbackModelId: "gpt-4o-mini",
    skillIds: Object.freeze([]),
  }),
]);

// ---------------------------------------------------------------------------
// Pure DOP Task Route Tier Classifier
// ---------------------------------------------------------------------------

/**
 * Classifies a user/agent task prompt into one of the 6 SubagentRouteTiers
 * using strict priority ordering:
 * 1. Local sovereign / privacy
 * 2. Vision / multimodal
 * 3. Decision / binary
 * 4. Coding / tests
 * 5. Deep reasoning / architecture
 * 6. Fast / conversational default
 */
export function classifyTaskRouteTier(
  prompt: string,
  toolCount?: number,
): SubagentRouteTier {
  const text = (prompt ?? "").trim();
  if (!text) {
    return "fast";
  }

  // 1. Sovereign Local / Privacy Priority
  const localRegex =
    /\[(local|offline|sovereign|privacy|airgap|internal-only)\]|\b(local only|run locally|offline mode|sovereign ai|air-gapped|private data|confidential|do not send to cloud)\b/i;
  if (localRegex.test(text)) {
    return "local";
  }

  // 2. Multimodal / Vision Priority
  const visionRegex =
    /\b(image|screenshot|photo|picture|diagram|wireframe|ocr|png|jpg|jpeg|svg|camera|visual inspection|visual)\b/i;
  if (visionRegex.test(text)) {
    return "vision";
  }

  // 3. Lightweight Binary / Routing Prompts (Decision Priority)
  const isShortPrompt = text.length < 250 || text.split(/\s+/).length < 40;
  const decisionRegex =
    /\b(approve|reject|allow|deny|yes\/no|true\/false|is this valid|gate check|should we|route to|classify intent|decision)\b|decision:/i;
  if (isShortPrompt && decisionRegex.test(text)) {
    return "decision";
  }

  // 4. Code / Refactor / Test Tasks (Coding Priority)
  const codeRegex =
    /\b(code|function|refactor|unit test|test suite|bug fix|debug|implement|typescript|python|rust|javascript|class|interface|sql|query|endpoint|git diff|pull request|pr|syntax error|compilation)\b/i;
  const hasCodeBlocks =
    text.includes("```") ||
    text.includes("import ") ||
    text.includes("function ") ||
    text.includes("const ") ||
    text.includes("class ");
  if (
    codeRegex.test(text) ||
    hasCodeBlocks ||
    (toolCount !== undefined && toolCount >= 3 && codeRegex.test(text))
  ) {
    return "coding";
  }

  // 5. Multi-Step Architecture & Security Audits (Deep Priority)
  const deepRegex =
    /\b(architecture|security audit|vulnerability|threat model|root cause|rca|system design|trade-off|adversarial|comprehensive review|multi-step|formal analysis|consensus)\b/i;
  if (
    deepRegex.test(text) ||
    (toolCount !== undefined && toolCount >= 5) ||
    text.length > 800
  ) {
    return "deep";
  }

  // 6. Fast conversational / default
  return "fast";
}

// ---------------------------------------------------------------------------
// Pure DOP Usage Window Gauge Helpers
// ---------------------------------------------------------------------------

export function createUsageGauge(params: {
  providerId: string;
  windowLimitTokens: number;
  usedTokens?: number;
  windowResetsAtMs: number;
  cooldownUntilMs?: number;
}): UsageWindowGauge {
  return Object.freeze({
    providerId: params.providerId,
    windowLimitTokens: params.windowLimitTokens,
    usedTokens: params.usedTokens ?? 0,
    windowResetsAtMs: params.windowResetsAtMs,
    ...(params.cooldownUntilMs !== undefined
      ? { cooldownUntilMs: params.cooldownUntilMs }
      : {}),
  });
}

export function isGaugeAvailable(
  gauge: UsageWindowGauge | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!gauge) {
    return true;
  }
  if (gauge.cooldownUntilMs !== undefined && gauge.cooldownUntilMs > nowMs) {
    return false;
  }
  if (
    gauge.windowResetsAtMs > nowMs &&
    gauge.usedTokens >= gauge.windowLimitTokens
  ) {
    return false;
  }
  return true;
}

export function recordTokensUsed(
  gauge: UsageWindowGauge,
  tokens: number,
  nowMs: number = Date.now(),
): UsageWindowGauge {
  const isReset = gauge.windowResetsAtMs <= nowMs;
  const nextUsed = isReset ? tokens : gauge.usedTokens + tokens;
  return Object.freeze({
    ...gauge,
    usedTokens: nextUsed,
  });
}

export function setGaugeCooldown(
  gauge: UsageWindowGauge,
  cooldownUntilMs: number,
): UsageWindowGauge {
  return Object.freeze({
    ...gauge,
    cooldownUntilMs,
  });
}

// ---------------------------------------------------------------------------
// Pure DOP Adaptive Model Route Resolver
// ---------------------------------------------------------------------------

export function resolveAdaptiveModelRoute(params: {
  tier?: SubagentRouteTier;
  profileId?: string;
  profiles?: readonly AgentProfileRoute[];
  gauges?: ReadonlyMap<string, UsageWindowGauge>;
  nowMs?: number;
}): AdaptiveModelRouteDecision {
  const now = params.nowMs ?? Date.now();
  const pool = params.profiles ?? DEFAULT_AGENT_PROFILE_ROUTES;

  // 1. Resolve Profile or Target Tier
  let matchedProfile: AgentProfileRoute | undefined;
  if (params.profileId) {
    matchedProfile = pool.find((p) => p.profileId === params.profileId);
  }
  if (!matchedProfile && params.tier) {
    matchedProfile = pool.find((p) => p.preferredTier === params.tier);
  }

  const effectiveTier: SubagentRouteTier =
    params.tier ?? matchedProfile?.preferredTier ?? "fast";
  const defaultTierDef = DEFAULT_TIER_ROUTES[effectiveTier];

  const primaryProviderId =
    matchedProfile?.providerId ?? defaultTierDef.providerId;
  const primaryModelId = matchedProfile?.modelId ?? defaultTierDef.modelId;
  const fallbackProviderId =
    matchedProfile?.fallbackProviderId ?? defaultTierDef.fallbackProviderId;
  const fallbackModelId =
    matchedProfile?.fallbackModelId ?? defaultTierDef.fallbackModelId;

  // 2. Assess Primary Provider Gauge
  const primaryGauge = params.gauges?.get(primaryProviderId);
  const primaryHealthy = isGaugeAvailable(primaryGauge, now);

  if (primaryHealthy) {
    const quotaInfo = primaryGauge
      ? ` [quota: ${primaryGauge.usedTokens}/${primaryGauge.windowLimitTokens}]`
      : "";
    return Object.freeze({
      providerId: primaryProviderId,
      modelId: primaryModelId,
      tier: effectiveTier,
      daybreakSwitched: false,
      reason: `Primary route selected for '${primaryProviderId}/${primaryModelId}' (tier: ${effectiveTier})${quotaInfo}.`,
    });
  }

  // 3. Daybreak Failover: Primary is exhausted or in cooldown
  const isCooledDown = Boolean(
    primaryGauge?.cooldownUntilMs && primaryGauge.cooldownUntilMs > now,
  );
  const blockCause = isCooledDown
    ? `active cooldown until ${primaryGauge?.cooldownUntilMs}`
    : `quota window exhausted (${primaryGauge?.usedTokens}/${primaryGauge?.windowLimitTokens})`;

  // Option A: Try Configured Fallback Provider
  if (fallbackProviderId && fallbackModelId) {
    const fallbackGauge = params.gauges?.get(fallbackProviderId);
    if (isGaugeAvailable(fallbackGauge, now)) {
      return Object.freeze({
        providerId: fallbackProviderId,
        modelId: fallbackModelId,
        tier: effectiveTier,
        daybreakSwitched: true,
        reason: `Primary provider '${primaryProviderId}' blocked (${blockCause}). Daybreak switched to configured fallback '${fallbackProviderId}/${fallbackModelId}'.`,
      });
    }
  }

  // Option B: Local Sovereign Failover (Ollama / vLLM)
  const ollamaGauge = params.gauges?.get("ollama");
  if (isGaugeAvailable(ollamaGauge, now)) {
    const localModel =
      effectiveTier === "coding"
        ? "qwen2.5-coder"
        : effectiveTier === "deep"
        ? "deepseek-r1"
        : "llama3.3";
    return Object.freeze({
      providerId: "ollama",
      modelId: localModel,
      tier: effectiveTier,
      daybreakSwitched: true,
      reason: `Primary provider '${primaryProviderId}' blocked (${blockCause}) and fallback unavailable. Daybreak switched to local sovereign 'ollama/${localModel}'.`,
    });
  }

  // Final Edge: vLLM default
  return Object.freeze({
    providerId: "vllm",
    modelId: "default",
    tier: effectiveTier,
    daybreakSwitched: true,
    reason: `Primary provider '${primaryProviderId}' blocked (${blockCause}). Daybreak switched to sovereign edge 'vllm/default'.`,
  });
}
