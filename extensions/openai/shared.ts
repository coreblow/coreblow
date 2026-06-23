import { findCatalogTemplate } from "coreblow/plugin-sdk/provider-catalog-shared";
import {
  cloneFirstTemplateModel,
  matchesExactOrPrefix,
  type ProviderPlugin,
} from "coreblow/plugin-sdk/provider-model-shared";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-contracts";
import {
  createOpenAIAttributionHeadersWrapper,
  createOpenAIDefaultTransportWrapper,
} from "coreblow/plugin-sdk/provider-stream";

export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toOpenAIDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function resolveConfiguredOpenAIBaseUrl(cfg: CoreBlowConfig | undefined): string {
  return normalizeOptionalString(cfg?.models?.providers?.openai?.baseUrl) ?? OPENAI_API_BASE_URL;
}

export function isOpenAIApiBaseUrl(baseUrl?: string): boolean {
  const trimmed = normalizeOptionalString(baseUrl);
  if (!trimmed) {
    return false;
  }
  return /^https?:\/\/api\.openai\.com(?:\/v1)?\/?$/i.test(trimmed);
}

type SyntheticOpenAIModelCatalogCost = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

type OpenAIResponsesTransport = "auto" | "sse" | "websocket";

function hasSupportedOpenAIResponsesTransport(
  transport: unknown,
): transport is OpenAIResponsesTransport {
  return transport === "auto" || transport === "sse" || transport === "websocket";
}

function defaultOpenAIResponsesExtraParams(
  extraParams: Record<string, unknown> | undefined,
  options?: { transport?: OpenAIResponsesTransport },
): Record<string, unknown> | undefined {
  const hasSupportedTransport = hasSupportedOpenAIResponsesTransport(extraParams?.transport);
  const defaultTransport = options?.transport ?? "auto";
  if (hasSupportedTransport) {
    return extraParams;
  }
  return {
    ...extraParams,
    transport: defaultTransport,
  };
}

type OpenAIResponsesProviderHooks = Pick<ProviderPlugin, "prepareExtraParams" | "wrapStreamFn">;

export function buildOpenAIResponsesProviderHooks(options?: {
  transport?: OpenAIResponsesTransport;
  applyDefaultTransportWrapper?: boolean;
}): OpenAIResponsesProviderHooks {
  return {
    prepareExtraParams: (ctx) => defaultOpenAIResponsesExtraParams(ctx.extraParams, options),
    wrapStreamFn: (ctx) => {
      const baseStreamFn = options?.applyDefaultTransportWrapper
        ? createOpenAIDefaultTransportWrapper(ctx.streamFn)
        : ctx.streamFn;
      return createOpenAIAttributionHeadersWrapper(baseStreamFn);
    },
  };
}

export function buildOpenAISyntheticCatalogEntry(
  template: ReturnType<typeof findCatalogTemplate>,
  entry: {
    id: string;
    reasoning?: boolean;
    input?: readonly ("text" | "image")[];
    contextWindow?: number;
    contextTokens?: number;
    cost?: SyntheticOpenAIModelCatalogCost;
  },
) {
  if (!template) {
    return undefined;
  }
  return {
    ...template,
    id: entry.id,
    name: entry.id,
    ...(entry.reasoning === undefined ? {} : { reasoning: entry.reasoning }),
    ...(entry.input === undefined ? {} : { input: [...entry.input] }),
    ...(entry.contextWindow === undefined ? {} : { contextWindow: entry.contextWindow }),
    ...(entry.contextTokens === undefined ? {} : { contextTokens: entry.contextTokens }),
    ...(entry.cost === undefined ? {} : { cost: entry.cost }),
  };
}

export { cloneFirstTemplateModel, findCatalogTemplate, matchesExactOrPrefix };
