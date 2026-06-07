import {
  type MemoryEmbeddingProvider,
  type MemoryEmbeddingProviderCreateOptions,
} from "coreblow/plugin-sdk/memory-core-host-engine-embeddings";
import { normalizeLowercaseStringOrEmpty } from "coreblow/plugin-sdk/string-coerce-runtime";
import { refreshAwsSharedConfigCacheForBedrock } from "./aws-credential-refresh.js";

type BedrockEmbeddingClient = {
  region: string;
  model: string;
  dimensions?: number;
};

export const DEFAULT_BEDROCK_EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0";

type Family = "titan-v1" | "titan-v2" | "cohere-v3" | "cohere-v4" | "nova" | "twelvelabs";

type ModelSpec = {
  maxTokens: number;
  dims: number;
  validDims?: number[];
  family: Family;
};

const MODELS: Record<string, ModelSpec> = {
  "amazon.titan-embed-text-v2:0": {
    maxTokens: 8192,
    dims: 1024,
    validDims: [256, 512, 1024],
    family: "titan-v2",
  },
  "amazon.titan-embed-text-v1": { maxTokens: 8000, dims: 1536, family: "titan-v1" },
  "cohere.embed-english-v3": { maxTokens: 512, dims: 1024, family: "cohere-v3" },
  "cohere.embed-multilingual-v3": { maxTokens: 512, dims: 1024, family: "cohere-v3" },
  "cohere.embed-v4:0": {
    maxTokens: 128000,
    dims: 1536,
    validDims: [256, 384, 512, 768, 1024, 1536],
    family: "cohere-v4",
  },
  "amazon.nova-2-multimodal-embeddings-v1:0": {
    maxTokens: 8192,
    dims: 1024,
    validDims: [256, 384, 1024, 3072],
    family: "nova",
  },
  "twelvelabs.marengo-embed-3-0-v1:0": { maxTokens: 512, dims: 512, family: "twelvelabs" },
};

type AwsCredentialProviderSdk = {
  defaultProvider: (init?: { timeout?: number; maxRetries?: number }) => () => Promise<{
    accessKeyId?: string;
  }>;
};

type AwsCredentialProviderLoader = () => Promise<AwsCredentialProviderSdk | null>;

async function loadCredentialProviderSdk(): Promise<AwsCredentialProviderSdk | null> {
  try {
    return (await import("@aws-sdk/credential-provider-node")) as unknown as AwsCredentialProviderSdk;
  } catch {
    return null;
  }
}

const MODEL_PREFIX_RE = /^(?:bedrock|amazon-bedrock|aws)\//;
const REGION_RE = /bedrock-runtime\.([a-z0-9-]+)\./;

function normalizeBedrockEmbeddingModel(model: string): string {
  const trimmed = model.trim();
  return trimmed ? trimmed.replace(MODEL_PREFIX_RE, "") : DEFAULT_BEDROCK_EMBEDDING_MODEL;
}

function resolveSpec(modelId: string): ModelSpec | undefined {
  if (MODELS[modelId]) {
    return MODELS[modelId];
  }
  const parts = modelId.split(":");
  for (let i = parts.length - 1; i >= 1; i--) {
    const spec = MODELS[parts.slice(0, i).join(":")];
    if (spec) {
      return spec;
    }
  }
  return undefined;
}

function inferFamily(modelId: string): Family {
  const id = normalizeLowercaseStringOrEmpty(modelId);
  if (id.startsWith("amazon.titan-embed-text-v2")) {
    return "titan-v2";
  }
  if (id.startsWith("amazon.titan-embed")) {
    return "titan-v1";
  }
  if (id.startsWith("amazon.nova")) {
    return "nova";
  }
  if (id.startsWith("cohere.embed-v4")) {
    return "cohere-v4";
  }
  if (id.startsWith("cohere.embed")) {
    return "cohere-v3";
  }
  if (id.startsWith("twelvelabs.")) {
    return "twelvelabs";
  }
  return "titan-v1";
}

function regionFromUrl(url: string | undefined): string | undefined {
  return url?.trim() ? REGION_RE.exec(url)?.[1] : undefined;
}

function malformedBedrockEmbeddingResponse(): Error {
  return new Error("Amazon Bedrock embedding response returned malformed JSON");
}

function parseBedrockEmbeddingResponseJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw malformedBedrockEmbeddingResponse();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw malformedBedrockEmbeddingResponse();
  }
}

function sanitizeAndNormalizeEmbedding(vec: number[]): number[] {
  if (vec.length === 0 || !vec.every((value) => Number.isFinite(value))) {
    throw malformedBedrockEmbeddingResponse();
  }
  const magnitude = Math.hypot(...vec);
  return magnitude > 0 ? vec.map((value) => value / magnitude) : vec;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "number")) {
    throw malformedBedrockEmbeddingResponse();
  }
  return value;
}

function parseSingleEmbeddingResponse(family: Family, raw: string): number[] {
  const json = parseBedrockEmbeddingResponseJson(raw);
  if (family === "cohere-v4") {
    const floats = (json.embeddings as { float?: unknown } | undefined)?.float;
    return sanitizeAndNormalizeEmbedding(asNumberArray(Array.isArray(floats) ? floats[0] : undefined));
  }
  if (family === "cohere-v3") {
    const embeddings = json.embeddings;
    return sanitizeAndNormalizeEmbedding(asNumberArray(Array.isArray(embeddings) ? embeddings[0] : undefined));
  }
  return sanitizeAndNormalizeEmbedding(asNumberArray(json.embedding));
}

function parseCohereBatchResponse(family: Family, raw: string): number[][] {
  const json = parseBedrockEmbeddingResponseJson(raw);
  const embeddings =
    family === "cohere-v4"
      ? (json.embeddings as { float?: unknown } | undefined)?.float
      : json.embeddings;
  if (!Array.isArray(embeddings)) {
    throw malformedBedrockEmbeddingResponse();
  }
  return embeddings.map((embedding) => sanitizeAndNormalizeEmbedding(asNumberArray(embedding)));
}

export async function hasAwsCredentials(
  env: NodeJS.ProcessEnv = process.env,
  loadCredentialProvider: AwsCredentialProviderLoader = loadCredentialProviderSdk,
): Promise<boolean> {
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    return true;
  }
  if (env.AWS_BEARER_TOKEN_BEDROCK) {
    return true;
  }
  const sdk = await loadCredentialProvider();
  if (!sdk) {
    return false;
  }
  try {
    const provider = sdk.defaultProvider({ timeout: 1000, maxRetries: 0 });
    const credential = await provider();
    return Boolean(credential.accessKeyId);
  } catch {
    return false;
  }
}

export async function createBedrockEmbeddingProvider(
  options: MemoryEmbeddingProviderCreateOptions & {
    provider?: string;
    fallback?: "none";
  },
): Promise<{ provider: MemoryEmbeddingProvider; client: BedrockEmbeddingClient }> {
  await refreshAwsSharedConfigCacheForBedrock();
  const model = normalizeBedrockEmbeddingModel(options.model);
  const spec = resolveSpec(model);
  const region =
    regionFromUrl(options.remote?.baseUrl) ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
  const dimensions = options.outputDimensionality ?? spec?.dims;
  const family = spec?.family ?? inferFamily(model);
  const client = { region, model, dimensions };

  return {
    client,
    provider: {
      id: options.provider ?? "bedrock",
      model,
      maxInputTokens: spec?.maxTokens,
      embedQuery: async () => {
        throw new Error("Amazon Bedrock embedding runtime requires @aws-sdk/client-bedrock-runtime");
      },
      embedBatch: async () => {
        throw new Error("Amazon Bedrock embedding runtime requires @aws-sdk/client-bedrock-runtime");
      },
    },
  };
}

export const testing = {
  parseSingle: parseSingleEmbeddingResponse,
  parseCohereBatch: parseCohereBatchResponse,
  inferFamily,
};
