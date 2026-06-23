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
type OpenAIToolCompatProviderHooks = Pick<
  ProviderPlugin,
  "normalizeToolSchemas" | "inspectToolSchemas"
>;
type ProviderNormalizeToolSchemasContext = Parameters<
  NonNullable<ProviderPlugin["normalizeToolSchemas"]>
>[0];

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

function isOpenAICodexBaseUrl(baseUrl?: string): boolean {
  const trimmed = normalizeOptionalString(baseUrl);
  return trimmed ? /^https:\/\/chatgpt\.com\/backend-api(?:\/|$)/i.test(trimmed) : false;
}

function shouldApplyOpenAIToolCompat(ctx: ProviderNormalizeToolSchemasContext): boolean {
  const provider = (ctx.model?.provider ?? ctx.provider).trim().toLowerCase();
  const api = (ctx.model?.api ?? ctx.modelApi ?? "").trim().toLowerCase();
  const baseUrl = normalizeOptionalString(ctx.model?.baseUrl);

  if (provider === "openai") {
    return api === "openai-responses" && (!baseUrl || isOpenAIApiBaseUrl(baseUrl));
  }
  if (provider === "openai-codex") {
    return (
      api === "openai-codex-responses" &&
      (!baseUrl || isOpenAIApiBaseUrl(baseUrl) || isOpenAICodexBaseUrl(baseUrl))
    );
  }
  return false;
}

const OPENAI_STRICT_COMPAT_SCHEMA_MAP_KEYS = new Set([
  "$defs",
  "definitions",
  "dependentSchemas",
  "patternProperties",
  "properties",
]);

const OPENAI_STRICT_COMPAT_SCHEMA_NESTED_KEYS = new Set([
  "additionalProperties",
  "allOf",
  "anyOf",
  "contains",
  "else",
  "if",
  "items",
  "not",
  "oneOf",
  "prefixItems",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
]);

function normalizeOpenAIStrictCompatSchemaMap(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return schema;
  }

  let changed = false;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    const next = normalizeOpenAIStrictCompatSchemaRecursive(value, false);
    normalized[key] = next;
    changed ||= next !== value;
  }
  return changed ? normalized : schema;
}

function normalizeOpenAIStrictCompatSchemaRecursive(
  schema: unknown,
  promoteEmptyObject: boolean,
): unknown {
  if (Array.isArray(schema)) {
    let changed = false;
    const normalized = schema.map((entry) => {
      const next = normalizeOpenAIStrictCompatSchemaRecursive(entry, false);
      changed ||= next !== entry;
      return next;
    });
    return changed ? normalized : schema;
  }
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const record = schema as Record<string, unknown>;
  let changed = false;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const next = OPENAI_STRICT_COMPAT_SCHEMA_MAP_KEYS.has(key)
      ? normalizeOpenAIStrictCompatSchemaMap(value)
      : OPENAI_STRICT_COMPAT_SCHEMA_NESTED_KEYS.has(key)
        ? normalizeOpenAIStrictCompatSchemaRecursive(value, false)
        : value;
    normalized[key] = next;
    changed ||= next !== value;
  }

  if (Object.keys(normalized).length === 0) {
    if (!promoteEmptyObject) {
      return schema;
    }
    return {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    };
  }

  const hasObjectShapeHints =
    !("type" in normalized) &&
    ((normalized.properties &&
      typeof normalized.properties === "object" &&
      !Array.isArray(normalized.properties)) ||
      Array.isArray(normalized.required));
  if (hasObjectShapeHints) {
    normalized.type = "object";
    changed = true;
  }

  if (normalized.type === "object" && !("properties" in normalized)) {
    normalized.properties = {};
    changed = true;
  }

  const hasEmptyProperties =
    normalized.properties &&
    typeof normalized.properties === "object" &&
    !Array.isArray(normalized.properties) &&
    Object.keys(normalized.properties as Record<string, unknown>).length === 0;

  if (normalized.type === "object" && !Array.isArray(normalized.required) && hasEmptyProperties) {
    normalized.required = [];
    changed = true;
  }

  if (
    normalized.type === "object" &&
    hasEmptyProperties &&
    !("additionalProperties" in normalized)
  ) {
    normalized.additionalProperties = false;
    changed = true;
  }

  return changed ? normalized : schema;
}

export function buildOpenAIToolCompatProviderHooks(): OpenAIToolCompatProviderHooks {
  return {
    normalizeToolSchemas: (ctx) => {
      if (!shouldApplyOpenAIToolCompat(ctx)) {
        return ctx.tools;
      }
      return ctx.tools.map((tool) => {
        if (tool.parameters == null) {
          return {
            ...tool,
            parameters: normalizeOpenAIStrictCompatSchemaRecursive({}, true),
          };
        }
        if (typeof tool.parameters !== "object") {
          return tool;
        }
        return {
          ...tool,
          parameters: normalizeOpenAIStrictCompatSchemaRecursive(tool.parameters, true),
        };
      });
    },
    inspectToolSchemas: () => [],
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
