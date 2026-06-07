import {
  type MemoryEmbeddingProvider,
  type MemoryEmbeddingProviderAdapter,
} from "coreblow/plugin-sdk/memory-core-host-engine-embeddings";
import { resolveConfiguredSecretInputString } from "coreblow/plugin-sdk/secret-input-runtime";
import { fetchWithSsrFGuard, type SsrFPolicy } from "coreblow/plugin-sdk/ssrf-runtime";
import { resolveFirstGithubToken } from "./auth.js";
import { DEFAULT_COPILOT_API_BASE_URL, resolveCopilotApiToken } from "./token.js";

const COPILOT_EMBEDDING_PROVIDER_ID = "github-copilot";
const PREFERRED_MODELS = [
  "text-embedding-3-small",
  "text-embedding-3-large",
  "text-embedding-ada-002",
] as const;

const COPILOT_HEADERS_STATIC: Record<string, string> = {
  "Content-Type": "application/json",
  "Accept-Encoding": "identity",
  "Editor-Version": "vscode/1.99.0",
  "Editor-Plugin-Version": "copilot-chat/0.26.7",
};

type CopilotModelEntry = {
  id?: unknown;
  supported_endpoints?: unknown;
};

type GitHubCopilotEmbeddingClient = {
  githubToken: string;
  model: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
};

function buildSsrfPolicy(baseUrl: string): SsrFPolicy | undefined {
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

function sanitizeAndNormalizeEmbedding(vec: number[]): number[] {
  if (vec.length === 0 || !vec.every((value) => Number.isFinite(value))) {
    throw new Error("GitHub Copilot embeddings response contains an invalid embedding");
  }
  const magnitude = Math.hypot(...vec);
  return magnitude > 0 ? vec.map((value) => value / magnitude) : vec;
}

function isCopilotSetupError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  return (
    err.message.includes("No GitHub token available") ||
    err.message.includes("Copilot token exchange failed") ||
    err.message.includes("Copilot token response") ||
    err.message.includes("No embedding models available") ||
    err.message.includes("GitHub Copilot model discovery") ||
    err.message.includes("GitHub Copilot embedding model") ||
    err.message.includes("Unexpected response from GitHub Copilot token endpoint")
  );
}

async function discoverEmbeddingModels(params: {
  baseUrl: string;
  copilotToken: string;
  headers?: Record<string, string>;
  ssrfPolicy?: SsrFPolicy;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  const url = `${params.baseUrl.replace(/\/$/, "")}/models`;
  const { response, release } = await fetchWithSsrFGuard({
    url,
    init: {
      method: "GET",
      headers: {
        ...COPILOT_HEADERS_STATIC,
        ...params.headers,
        Authorization: `Bearer ${params.copilotToken}`,
      },
    },
    fetchImpl: params.fetchImpl,
    policy: params.ssrfPolicy,
    auditContext: "memory-remote",
  });
  try {
    if (!response.ok) {
      throw new Error(
        `GitHub Copilot model discovery HTTP ${response.status}: ${await response.text()}`,
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("GitHub Copilot model discovery returned invalid JSON");
    }
    const allModels = Array.isArray((payload as { data?: unknown })?.data)
      ? ((payload as { data: CopilotModelEntry[] }).data ?? [])
      : [];
    return allModels.flatMap((entry) => {
      const id = typeof entry.id === "string" ? entry.id.trim() : "";
      if (!id) {
        return [];
      }
      const endpoints = Array.isArray(entry.supported_endpoints)
        ? entry.supported_endpoints.filter((value): value is string => typeof value === "string")
        : [];
      return endpoints.some((ep) => ep.includes("embeddings")) || /\bembedding/i.test(id)
        ? [id]
        : [];
    });
  } finally {
    await release();
  }
}

function pickBestModel(available: string[], userModel?: string): string {
  if (userModel) {
    const normalized = userModel.trim();
    const stripped = normalized.startsWith(`${COPILOT_EMBEDDING_PROVIDER_ID}/`)
      ? normalized.slice(`${COPILOT_EMBEDDING_PROVIDER_ID}/`.length)
      : normalized;
    if (available.length === 0) {
      throw new Error("No embedding models available from GitHub Copilot");
    }
    if (!available.includes(stripped)) {
      throw new Error(
        `GitHub Copilot embedding model "${stripped}" is not available. Available: ${available.join(", ")}`,
      );
    }
    return stripped;
  }
  for (const preferred of PREFERRED_MODELS) {
    if (available.includes(preferred)) {
      return preferred;
    }
  }
  if (available.length > 0) {
    return available[0] ?? PREFERRED_MODELS[0];
  }
  throw new Error("No embedding models available from GitHub Copilot");
}

function parseGitHubCopilotEmbeddingPayload(payload: unknown, expectedCount: number): number[][] {
  if (!payload || typeof payload !== "object") {
    throw new Error("GitHub Copilot embeddings response missing data[]");
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error("GitHub Copilot embeddings response missing data[]");
  }

  const vectors = Array.from<number[] | undefined>({ length: expectedCount });
  for (const entry of data) {
    if (!entry || typeof entry !== "object") {
      throw new Error("GitHub Copilot embeddings response contains an invalid entry");
    }
    const indexValue = (entry as { index?: unknown }).index;
    const embedding = (entry as { embedding?: unknown }).embedding;
    const index = typeof indexValue === "number" ? indexValue : Number.NaN;
    if (!Number.isInteger(index) || index < 0 || index >= expectedCount) {
      throw new Error("GitHub Copilot embeddings response contains an invalid index");
    }
    if (vectors[index] !== undefined) {
      throw new Error("GitHub Copilot embeddings response contains duplicate indexes");
    }
    if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === "number")) {
      throw new Error("GitHub Copilot embeddings response contains an invalid embedding");
    }
    vectors[index] = sanitizeAndNormalizeEmbedding(embedding);
  }

  for (let index = 0; index < expectedCount; index += 1) {
    if (vectors[index] === undefined) {
      throw new Error("GitHub Copilot embeddings response missing vectors for some inputs");
    }
  }
  return vectors as number[][];
}

async function resolveGitHubCopilotEmbeddingSession(client: GitHubCopilotEmbeddingClient): Promise<{
  baseUrl: string;
  headers: Record<string, string>;
}> {
  const token = await resolveCopilotApiToken({
    githubToken: client.githubToken,
    env: client.env,
    fetchImpl: client.fetchImpl,
  });
  const baseUrl = client.baseUrl?.trim() || token.baseUrl || DEFAULT_COPILOT_API_BASE_URL;
  return {
    baseUrl,
    headers: {
      ...COPILOT_HEADERS_STATIC,
      ...client.headers,
      Authorization: `Bearer ${token.token}`,
    },
  };
}

async function createGitHubCopilotEmbeddingProvider(
  client: GitHubCopilotEmbeddingClient,
): Promise<{ provider: MemoryEmbeddingProvider; client: GitHubCopilotEmbeddingClient }> {
  const initialSession = await resolveGitHubCopilotEmbeddingSession(client);
  const available = await discoverEmbeddingModels({
    baseUrl: initialSession.baseUrl,
    copilotToken: initialSession.headers.Authorization.replace(/^Bearer\s+/i, ""),
    headers: client.headers,
    ssrfPolicy: buildSsrfPolicy(initialSession.baseUrl),
    fetchImpl: client.fetchImpl,
  });
  const model = pickBestModel(available, client.model);
  client.model = model;

  const embedBatch = async (input: string[]): Promise<number[][]> => {
    if (input.length === 0) {
      return [];
    }
    const session = await resolveGitHubCopilotEmbeddingSession(client);
    const url = `${session.baseUrl.replace(/\/$/, "")}/embeddings`;
    const { response, release } = await fetchWithSsrFGuard({
      url,
      init: {
        method: "POST",
        headers: session.headers,
        body: JSON.stringify({ model: client.model, input }),
      },
      fetchImpl: client.fetchImpl,
      policy: buildSsrfPolicy(session.baseUrl),
      auditContext: "memory-remote",
    });
    try {
      if (!response.ok) {
        throw new Error(`GitHub Copilot embeddings HTTP ${response.status}: ${await response.text()}`);
      }
      return parseGitHubCopilotEmbeddingPayload(await response.json(), input.length);
    } finally {
      await release();
    }
  };

  return {
    provider: {
      id: COPILOT_EMBEDDING_PROVIDER_ID,
      model,
      embedQuery: async (text) => (await embedBatch([text]))[0] ?? [],
      embedBatch,
    },
    client,
  };
}

function resolveRemoteApiKey(options: {
  config: unknown;
  env?: NodeJS.ProcessEnv;
  apiKey?: unknown;
}): string | undefined {
  if (options.apiKey === undefined) {
    return undefined;
  }
  const resolved = resolveConfiguredSecretInputString({
    config: options.config,
    env: options.env,
    value: options.apiKey,
    path: "memory.embeddings.remote.apiKey",
  });
  return resolved.status === "available" ? resolved.value.trim() : undefined;
}

export const githubCopilotMemoryEmbeddingProviderAdapter: MemoryEmbeddingProviderAdapter = {
  id: COPILOT_EMBEDDING_PROVIDER_ID,
  defaultModel: PREFERRED_MODELS[0],
  transport: "remote",
  autoSelectPriority: 15,
  allowExplicitWhenConfiguredAuto: true,
  shouldContinueAutoSelection: isCopilotSetupError,
  formatSetupError: (err) => (err instanceof Error ? err.message : String(err)),
  create: async (options) => {
    const githubToken =
      resolveRemoteApiKey({
        config: options.config,
        env: process.env,
        apiKey: options.remote?.apiKey,
      }) ??
      (
        await resolveFirstGithubToken({
          agentDir: options.agentDir,
          config: options.config,
          env: process.env,
        })
      ).githubToken;

    if (!githubToken) {
      throw new Error("No GitHub token available for GitHub Copilot embeddings");
    }

    return await createGitHubCopilotEmbeddingProvider({
      githubToken,
      model: options.model,
      baseUrl: options.remote?.baseUrl,
      headers: options.remote?.headers,
      env: process.env,
    });
  },
};
