import { createSubsystemLogger } from "coreblow/plugin-sdk/logging-core";
import type { ModelDefinitionConfig } from "coreblow/plugin-sdk/provider-model-shared";
import { SELF_HOSTED_DEFAULT_COST } from "coreblow/plugin-sdk/provider-setup";
import { fetchWithSsrFGuard, type SsrFPolicy } from "coreblow/plugin-sdk/ssrf-runtime";
import { LMSTUDIO_DEFAULT_LOAD_CONTEXT_LENGTH } from "./defaults.js";
import {
  buildLmstudioModelName,
  mapLmstudioWireEntry,
  resolveLmstudioServerBase,
  resolveLoadedContextWindow,
  type LmstudioModelWire,
} from "./models.js";
import { buildLmstudioAuthHeaders } from "./runtime.js";

const log = createSubsystemLogger("extensions/lmstudio/models");

type LmstudioLoadResponse = {
  status?: string;
};

export type FetchLmstudioModelsResult = {
  reachable: boolean;
  status?: number;
  models: LmstudioModelWire[];
  error?: unknown;
};

type FetchLmstudioEndpointParams = {
  url: string;
  init?: RequestInit;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  ssrfPolicy?: SsrFPolicy;
  auditContext: string;
};

async function fetchLmstudioEndpoint(
  params: FetchLmstudioEndpointParams,
): Promise<{ response: Response; release: () => Promise<void> }> {
  if (params.ssrfPolicy) {
    return await fetchWithSsrFGuard({
      url: params.url,
      init: params.init,
      timeoutMs: params.timeoutMs,
      fetchImpl: params.fetchImpl,
      policy: params.ssrfPolicy,
      auditContext: params.auditContext,
    });
  }
  const fetchFn = params.fetchImpl ?? fetch;
  return {
    response: await fetchFn(params.url, {
      ...params.init,
      signal: AbortSignal.timeout(params.timeoutMs),
    }),
    release: async () => {},
  };
}

function asLmstudioModelWire(value: unknown): LmstudioModelWire {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("LM Studio model list: malformed JSON response");
  }
  return value as LmstudioModelWire;
}

function readModelsArray(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("LM Studio model list: malformed JSON response");
  }
  const models = (payload as Record<string, unknown>).models;
  if (!Array.isArray(models)) {
    throw new Error("LM Studio model list: missing models[]");
  }
  return models;
}

export async function fetchLmstudioModels(params: {
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  ssrfPolicy?: SsrFPolicy;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<FetchLmstudioModelsResult> {
  const baseUrl = resolveLmstudioServerBase(params.baseUrl);
  const timeoutMs = params.timeoutMs ?? 5000;
  try {
    const { response, release } = await fetchLmstudioEndpoint({
      url: `${baseUrl}/api/v1/models`,
      init: {
        headers: buildLmstudioAuthHeaders({
          apiKey: params.apiKey,
          headers: params.headers,
        }),
      },
      timeoutMs,
      fetchImpl: params.fetchImpl,
      ssrfPolicy: params.ssrfPolicy,
      auditContext: "lmstudio-model-discovery",
    });
    try {
      if (!response.ok) {
        return {
          reachable: true,
          status: response.status,
          models: [],
        };
      }
      return {
        reachable: true,
        status: response.status,
        models: readModelsArray(await response.json()).map(asLmstudioModelWire),
      };
    } finally {
      await release();
    }
  } catch (error) {
    return {
      reachable: false,
      models: [],
      error,
    };
  }
}

export async function discoverLmstudioModels(params: {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  quiet: boolean;
  fetchImpl?: typeof fetch;
}): Promise<ModelDefinitionConfig[]> {
  const fetched = await fetchLmstudioModels({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    headers: params.headers,
    fetchImpl: params.fetchImpl,
  });
  if (!fetched.reachable) {
    if (!params.quiet) {
      log.debug(`Failed to discover LM Studio models: ${String(fetched.error)}`);
    }
    return [];
  }
  if (fetched.status !== undefined && fetched.status >= 400) {
    if (!params.quiet) {
      log.debug(`Failed to discover LM Studio models: ${fetched.status}`);
    }
    return [];
  }
  if (fetched.models.length === 0) {
    if (!params.quiet) {
      log.debug("No LM Studio models found on local instance");
    }
    return [];
  }

  return fetched.models
    .map((entry): ModelDefinitionConfig | null => {
      const base = mapLmstudioWireEntry(entry);
      if (!base) {
        return null;
      }
      return {
        id: base.id,
        name: buildLmstudioModelName(base),
        reasoning: base.reasoning,
        input: base.input,
        cost: SELF_HOSTED_DEFAULT_COST,
        compat: { ...base.compat, supportsUsageInStreaming: true },
        contextWindow: base.contextWindow,
        maxTokens: base.maxTokens,
      };
    })
    .filter((entry): entry is ModelDefinitionConfig => entry !== null);
}

export async function ensureLmstudioModelLoaded(params: {
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  ssrfPolicy?: SsrFPolicy;
  modelKey: string;
  requestedContextLength?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const modelKey = params.modelKey.trim();
  if (!modelKey) {
    throw new Error("LM Studio model key is required");
  }

  const timeoutMs = params.timeoutMs ?? 30_000;
  const baseUrl = resolveLmstudioServerBase(params.baseUrl);
  const preflight = await fetchLmstudioModels({
    baseUrl,
    apiKey: params.apiKey,
    headers: params.headers,
    ssrfPolicy: params.ssrfPolicy,
    timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  if (!preflight.reachable) {
    throw new Error(`LM Studio model discovery failed: ${String(preflight.error)}`);
  }
  if (preflight.status !== undefined && preflight.status >= 400) {
    throw new Error(`LM Studio model discovery failed (${preflight.status})`);
  }
  const matchingModel = preflight.models.find((entry) => entry.key?.trim() === modelKey);
  const loadedContextWindow = matchingModel ? resolveLoadedContextWindow(matchingModel) : null;
  const advertisedContextLimit =
    matchingModel?.max_context_length !== undefined &&
    Number.isFinite(matchingModel.max_context_length) &&
    matchingModel.max_context_length > 0
      ? Math.floor(matchingModel.max_context_length)
      : null;
  const requestedContextLength =
    params.requestedContextLength !== undefined &&
    Number.isFinite(params.requestedContextLength) &&
    params.requestedContextLength > 0
      ? Math.floor(params.requestedContextLength)
      : null;
  const contextLengthForLoad =
    advertisedContextLimit === null
      ? (requestedContextLength ?? LMSTUDIO_DEFAULT_LOAD_CONTEXT_LENGTH)
      : Math.min(
          requestedContextLength ?? LMSTUDIO_DEFAULT_LOAD_CONTEXT_LENGTH,
          advertisedContextLimit,
        );
  if (loadedContextWindow !== null && loadedContextWindow >= contextLengthForLoad) {
    return;
  }

  const { response, release } = await fetchLmstudioEndpoint({
    url: `${baseUrl}/api/v1/models/load`,
    init: {
      method: "POST",
      headers: buildLmstudioAuthHeaders({
        apiKey: params.apiKey,
        headers: params.headers,
        json: true,
      }),
      body: JSON.stringify({
        model: modelKey,
        context_length: contextLengthForLoad,
      }),
    },
    timeoutMs,
    fetchImpl: params.fetchImpl,
    ssrfPolicy: params.ssrfPolicy,
    auditContext: "lmstudio-model-load",
  });
  try {
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LM Studio model load failed (${response.status})${body ? `: ${body}` : ""}`);
    }
    let payload: LmstudioLoadResponse;
    try {
      payload = (await response.json()) as LmstudioLoadResponse;
    } catch (cause) {
      throw new Error("LM Studio model load returned malformed JSON", { cause });
    }
    if (typeof payload.status === "string" && payload.status.toLowerCase() !== "loaded") {
      throw new Error(`LM Studio model load returned unexpected status: ${payload.status}`);
    }
  } finally {
    await release();
  }
}
