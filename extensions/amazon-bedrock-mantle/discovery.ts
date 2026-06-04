import { createSubsystemLogger } from "coreblow/plugin-sdk/core";
import type {
  ModelDefinitionConfig,
  ModelProviderConfig,
} from "coreblow/plugin-sdk/provider-model-shared";

const log = createSubsystemLogger("bedrock-mantle-discovery");

const DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const DEFAULT_CONTEXT_WINDOW = 32000;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_REFRESH_INTERVAL_SECONDS = 3600;
const IAM_TOKEN_TTL_MS = 7200_000;
export const MANTLE_IAM_TOKEN_MARKER = "__amazon_bedrock_mantle_iam__";

const MANTLE_SUPPORTED_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "ap-northeast-1",
  "ap-south-1",
  "ap-southeast-3",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-south-1",
  "eu-north-1",
  "sa-east-1",
] as const;

type MantleBearerTokenProvider = () => Promise<string>;
export type MantleBearerTokenProviderFactory = (opts?: {
  region?: string;
  expiresInSeconds?: number;
}) => MantleBearerTokenProvider;

type MantleDiscoveryConfig = {
  enabled?: boolean;
};

interface MantleCacheEntry {
  models: ModelDefinitionConfig[];
  fetchedAt: number;
}

interface OpenAIModelEntry {
  id: string;
}

interface OpenAIModelsResponse {
  data?: OpenAIModelEntry[];
}

const REASONING_PATTERNS = [
  "thinking",
  "reasoner",
  "reasoning",
  "deepseek.r",
  "gpt-oss-120b",
  "gpt-oss-safeguard-120b",
];

const iamTokenCache = new Map<string, { token: string; expiresAt: number }>();
const discoveryCache = new Map<string, MantleCacheEntry>();

function mantleEndpoint(region: string): string {
  return `https://bedrock-mantle.${region}.api.aws`;
}

function isSupportedRegion(region: string): boolean {
  return (MANTLE_SUPPORTED_REGIONS as readonly string[]).includes(region);
}

function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadMantleBearerTokenProviderFactory(): Promise<MantleBearerTokenProviderFactory> {
  const moduleName = ["@aws", "bedrock-token-generator"].join("/");
  const { getTokenProvider } = (await import(moduleName)) as {
    getTokenProvider: MantleBearerTokenProviderFactory;
  };
  return getTokenProvider;
}

export function resolveMantleBearerToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicitToken = env.AWS_BEARER_TOKEN_BEDROCK?.trim();
  return explicitToken || undefined;
}

function resolveMantleRegion(env: NodeJS.ProcessEnv): string {
  return env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? "us-east-1";
}

function getCachedIamTokenEntry(
  region: string,
  now: number = Date.now(),
): { token: string; expiresAt: number } | undefined {
  const cached = iamTokenCache.get(region);
  if (cached && cached.expiresAt > now) {
    return cached;
  }
  return undefined;
}

export async function generateBearerTokenFromIam(params: {
  region: string;
  now?: () => number;
  tokenProviderFactory?: MantleBearerTokenProviderFactory;
}): Promise<string | undefined> {
  const now = params.now?.() ?? Date.now();
  const cached = getCachedIamTokenEntry(params.region, now);

  if (cached) {
    return cached.token;
  }

  try {
    const getTokenProvider =
      params.tokenProviderFactory ?? (await loadMantleBearerTokenProviderFactory());
    const token = await getTokenProvider({
      region: params.region,
      expiresInSeconds: 7200,
    })();
    iamTokenCache.set(params.region, { token, expiresAt: now + IAM_TOKEN_TTL_MS });
    return token;
  } catch (error) {
    log.debug?.("Mantle IAM token generation unavailable", {
      region: params.region,
      error: formatErrorMessage(error),
    });
    return undefined;
  }
}

export function getCachedIamToken(region: string): string | undefined {
  return getCachedIamTokenEntry(region)?.token;
}

export async function resolveMantleRuntimeBearerToken(params: {
  apiKey: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  tokenProviderFactory?: MantleBearerTokenProviderFactory;
}): Promise<{ apiKey: string; expiresAt?: number } | undefined> {
  if (params.apiKey !== MANTLE_IAM_TOKEN_MARKER) {
    return { apiKey: params.apiKey };
  }
  const now = params.now?.() ?? Date.now();
  const region = resolveMantleRegion(params.env ?? process.env);
  const cached = getCachedIamTokenEntry(region, now);
  if (cached) {
    return {
      apiKey: cached.token,
      expiresAt: cached.expiresAt,
    };
  }
  const token = await generateBearerTokenFromIam({
    region,
    now: params.now,
    tokenProviderFactory: params.tokenProviderFactory,
  });
  if (!token) {
    return undefined;
  }
  const refreshed = getCachedIamTokenEntry(region, now);
  return {
    apiKey: refreshed?.token ?? token,
    expiresAt: refreshed?.expiresAt ?? now + IAM_TOKEN_TTL_MS,
  };
}

export function resetIamTokenCacheForTest(): void {
  iamTokenCache.clear();
}

export function resetMantleDiscoveryCacheForTest(): void {
  discoveryCache.clear();
}

function inferReasoningSupport(modelId: string): boolean {
  const lower = normalizeLowercaseStringOrEmpty(modelId);
  return REASONING_PATTERNS.some((pattern) => lower.includes(pattern));
}

export async function discoverMantleModels(params: {
  region: string;
  bearerToken: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}): Promise<ModelDefinitionConfig[]> {
  const { region, bearerToken, fetchFn = fetch, now = Date.now } = params;

  const cached = discoveryCache.get(region);
  if (cached && now() - cached.fetchedAt < DEFAULT_REFRESH_INTERVAL_SECONDS * 1000) {
    return cached.models;
  }

  try {
    const response = await fetchFn(`${mantleEndpoint(region)}/v1/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      log.debug?.("Mantle model discovery failed", {
        status: response.status,
        statusText: response.statusText,
      });
      return cached?.models ?? [];
    }

    const body = (await response.json()) as OpenAIModelsResponse;
    const models = (body.data ?? [])
      .filter((model) => model.id?.trim())
      .map((model) => ({
        id: model.id,
        name: model.id,
        reasoning: inferReasoningSupport(model.id),
        input: ["text" as const],
        cost: DEFAULT_COST,
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        maxTokens: DEFAULT_MAX_TOKENS,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id));

    discoveryCache.set(region, { models, fetchedAt: now() });
    return models;
  } catch (error) {
    log.debug?.("Mantle model discovery error", { error: formatErrorMessage(error) });
    return cached?.models ?? [];
  }
}

export async function resolveImplicitMantleProvider(params: {
  env?: NodeJS.ProcessEnv;
  pluginConfig?: { discovery?: MantleDiscoveryConfig };
  fetchFn?: typeof fetch;
  tokenProviderFactory?: MantleBearerTokenProviderFactory;
}): Promise<ModelProviderConfig | null> {
  const env = params.env ?? process.env;
  if (params.pluginConfig?.discovery?.enabled === false) {
    return null;
  }
  const region = resolveMantleRegion(env);
  const explicitBearerToken = resolveMantleBearerToken(env);

  if (!isSupportedRegion(region)) {
    log.debug?.("Mantle not available in region", { region });
    return null;
  }

  const bearerToken =
    explicitBearerToken ??
    (await generateBearerTokenFromIam({
      region,
      tokenProviderFactory: params.tokenProviderFactory,
    }));

  if (!bearerToken) {
    return null;
  }

  const models = await discoverMantleModels({
    region,
    bearerToken,
    fetchFn: params.fetchFn,
  });

  if (models.length === 0) {
    return null;
  }

  const claudeModels: ModelDefinitionConfig[] = [
    {
      id: "anthropic.claude-opus-4-7",
      name: "Claude Opus 4.7",
      api: "anthropic-messages",
      reasoning: false,
      input: ["text", "image"],
      cost: {
        input: 5,
        output: 25,
        cacheRead: 0.5,
        cacheWrite: 6.25,
      },
      contextWindow: 1_000_000,
      maxTokens: 128_000,
    },
  ];

  return {
    baseUrl: `${mantleEndpoint(region)}/v1`,
    api: "openai-completions",
    auth: "api-key",
    apiKey: explicitBearerToken ? "env:AWS_BEARER_TOKEN_BEDROCK" : MANTLE_IAM_TOKEN_MARKER,
    models: [...models, ...claudeModels],
  };
}

export function mergeImplicitMantleProvider(params: {
  existing: ModelProviderConfig | undefined;
  implicit: ModelProviderConfig;
}): ModelProviderConfig {
  const { existing, implicit } = params;
  if (!existing) {
    return implicit;
  }
  return {
    ...implicit,
    ...existing,
    models:
      Array.isArray(existing.models) && existing.models.length > 0
        ? existing.models
        : implicit.models,
  };
}
