import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { AnthropicVertexStreamDeps } from "./stream-runtime.js";
export {
  ANTHROPIC_VERTEX_DEFAULT_MODEL_ID,
  buildAnthropicVertexProvider,
} from "./provider-catalog.js";
export {
  hasAnthropicVertexAvailableAuth,
  hasAnthropicVertexCredentials,
  resolveAnthropicVertexClientRegion,
  resolveAnthropicVertexConfigApiKey,
  resolveAnthropicVertexProjectId,
  resolveAnthropicVertexRegion,
  resolveAnthropicVertexRegionFromBaseUrl,
} from "./region.js";
import { buildAnthropicVertexProvider } from "./provider-catalog.js";
import { hasAnthropicVertexAvailableAuth } from "./region.js";

export function mergeImplicitAnthropicVertexProvider(params: {
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

export function resolveImplicitAnthropicVertexProvider(params?: {
  env?: NodeJS.ProcessEnv;
}): ModelProviderConfig | null {
  const env = params?.env ?? process.env;
  if (!hasAnthropicVertexAvailableAuth(env)) {
    return null;
  }

  return buildAnthropicVertexProvider({ env });
}

export function createAnthropicVertexStreamFn(
  projectId: string | undefined,
  region: string,
  baseURL?: string,
  _deps?: AnthropicVertexStreamDeps,
): StreamFn {
  const streamFnPromise = import("./stream-runtime.js").then((runtime) =>
    runtime.createAnthropicVertexStreamFn(projectId, region, baseURL),
  );
  return async (model, context, options) => {
    const streamFn = await streamFnPromise;
    return await streamFn(model, context, options);
  };
}

export function createAnthropicVertexStreamFnForModel(
  model: { baseUrl?: string },
  env: NodeJS.ProcessEnv = process.env,
  _deps?: AnthropicVertexStreamDeps,
): StreamFn {
  const streamFnPromise = import("./stream-runtime.js").then((runtime) =>
    runtime.createAnthropicVertexStreamFnForModel(model, env),
  );
  return async (...args) => {
    const streamFn = await streamFnPromise;
    return await streamFn(...args);
  };
}
