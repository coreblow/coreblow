import {
  type MemoryEmbeddingProvider,
  type MemoryEmbeddingProviderCreateOptions,
} from "coreblow/plugin-sdk/memory-core-host-engine-embeddings";
import { normalizeResolvedSecretInputString } from "coreblow/plugin-sdk/secret-input";
import {
  fetchWithSsrFGuard,
  formatErrorMessage,
  type SsrFPolicy,
} from "coreblow/plugin-sdk/ssrf-runtime";
import { LMSTUDIO_DEFAULT_EMBEDDING_MODEL, LMSTUDIO_PROVIDER_ID } from "./defaults.js";
import { ensureLmstudioModelLoaded } from "./models.fetch.js";
import { resolveLmstudioInferenceBase } from "./models.js";
import {
  buildLmstudioAuthHeaders,
  resolveLmstudioProviderHeaders,
  resolveLmstudioRuntimeApiKey,
} from "./runtime.js";

export const DEFAULT_LMSTUDIO_EMBEDDING_MODEL = LMSTUDIO_DEFAULT_EMBEDDING_MODEL;

export type LmstudioEmbeddingClient = {
  baseUrl: string;
  headers: Record<string, string>;
  ssrfPolicy?: SsrFPolicy;
  model: string;
};

function normalizeLmstudioModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return DEFAULT_LMSTUDIO_EMBEDDING_MODEL;
  }
  return trimmed.startsWith("lmstudio/") ? trimmed.slice("lmstudio/".length) : trimmed;
}

function buildRemoteBaseUrlPolicy(baseUrl: string): SsrFPolicy | undefined {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return { allowedHostnames: [parsed.hostname] };
  } catch {
    return undefined;
  }
}

function hasAuthorizationHeader(headers: Record<string, string> | undefined): boolean {
  return Object.entries(headers ?? {}).some(
    ([headerName, value]) =>
      headerName.trim().toLowerCase() === "authorization" && value.trim().length > 0,
  );
}

function resolveMemorySecretInputString(params: { value: unknown; path: string }): string | undefined {
  if (params.value === undefined || params.value === null) {
    return undefined;
  }
  return normalizeResolvedSecretInputString({
    value: params.value,
    path: params.path,
  });
}

async function resolveLmstudioApiKey(
  options: MemoryEmbeddingProviderCreateOptions,
): Promise<string | undefined> {
  try {
    return await resolveLmstudioRuntimeApiKey({
      config: options.config,
      agentDir: options.agentDir,
    });
  } catch (error) {
    if (/LM Studio API key is required/iu.test(formatErrorMessage(error))) {
      return undefined;
    }
    throw error;
  }
}

function sanitizeAndNormalizeEmbedding(vec: number[]): number[] {
  const sanitized = vec.map((value) => (Number.isFinite(value) ? value : 0));
  const magnitude = Math.sqrt(sanitized.reduce((sum, value) => sum + value * value, 0));
  return magnitude < 1e-10 ? sanitized : sanitized.map((value) => value / magnitude);
}

async function postLmstudioEmbeddings(params: {
  client: LmstudioEmbeddingClient;
  input: string | string[];
}): Promise<number[][]> {
  const { response, release } = await fetchWithSsrFGuard({
    url: `${params.client.baseUrl.replace(/\/$/u, "")}/embeddings`,
    init: {
      method: "POST",
      headers: params.client.headers,
      body: JSON.stringify({
        model: params.client.model,
        input: params.input,
      }),
    },
    policy: params.client.ssrfPolicy,
    auditContext: "memory-remote",
  });
  try {
    if (!response.ok) {
      throw new Error(`LM Studio embeddings HTTP ${response.status}: ${await response.text()}`);
    }
    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      embedding?: number[];
    };
    if (Array.isArray(payload.data)) {
      return payload.data.map((entry) => {
        if (!Array.isArray(entry.embedding)) {
          throw new Error("LM Studio embeddings response missing data[].embedding[]");
        }
        return sanitizeAndNormalizeEmbedding(entry.embedding);
      });
    }
    if (Array.isArray(payload.embedding)) {
      return [sanitizeAndNormalizeEmbedding(payload.embedding)];
    }
    throw new Error("LM Studio embeddings response missing embedding data");
  } finally {
    await release();
  }
}

export async function createLmstudioEmbeddingProvider(
  options: MemoryEmbeddingProviderCreateOptions,
): Promise<{ provider: MemoryEmbeddingProvider; client: LmstudioEmbeddingClient }> {
  const providerConfig = options.config.models?.providers?.lmstudio;
  const configuredBaseUrl =
    options.remote?.baseUrl?.trim() || providerConfig?.baseUrl?.trim() || undefined;
  const baseUrl = resolveLmstudioInferenceBase(configuredBaseUrl);
  const model = normalizeLmstudioModel(options.model);
  const providerHeaders = await resolveLmstudioProviderHeaders({
    config: options.config,
    env: process.env,
    headers: Object.assign({}, providerConfig?.headers, options.remote?.headers),
  });
  const remoteApiKey = resolveMemorySecretInputString({
    value: options.remote?.apiKey,
    path: "agents.*.memorySearch.remote.apiKey",
  });
  const apiKey = hasAuthorizationHeader(providerHeaders)
    ? undefined
    : remoteApiKey?.trim() || (await resolveLmstudioApiKey(options));
  const headers =
    buildLmstudioAuthHeaders({
      apiKey,
      json: true,
      headers: providerHeaders,
    }) ?? {};
  const client: LmstudioEmbeddingClient = {
    baseUrl,
    model,
    headers,
    ssrfPolicy: buildRemoteBaseUrlPolicy(baseUrl),
  };

  try {
    await ensureLmstudioModelLoaded({
      baseUrl,
      apiKey,
      headers: providerHeaders,
      ssrfPolicy: client.ssrfPolicy,
      modelKey: model,
      timeoutMs: 120_000,
    });
  } catch {
    // Warmup is best effort; embedding itself will surface actual transport errors.
  }

  const provider: MemoryEmbeddingProvider = {
    id: LMSTUDIO_PROVIDER_ID,
    model,
    embedQuery: async (text) => (await postLmstudioEmbeddings({ client, input: text }))[0] ?? [],
    embedBatch: async (texts) => await postLmstudioEmbeddings({ client, input: texts }),
  };

  return { provider, client };
}
