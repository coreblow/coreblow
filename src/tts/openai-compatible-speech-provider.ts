import type { SpeechProviderPlugin } from "../plugins/types.js";
import { assertOkOrThrowHttpError, postJsonRequest } from "../plugin-sdk/provider-http.js";
import { asObject } from "../plugin-sdk/speech-core.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import type {
  SpeechDirectiveTokenParseContext,
  SpeechProviderConfig,
  SpeechProviderOverrides,
} from "./provider-types.js";

function trimToUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

type OpenAiCompatibleSpeechProviderBaseConfig = {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  voice: string;
  speed?: number;
  responseFormat?: string;
};

export type OpenAiCompatibleSpeechProviderConfig<
  ExtraConfig extends Record<string, unknown> = Record<string, never>,
> = OpenAiCompatibleSpeechProviderBaseConfig & ExtraConfig;

export type OpenAiCompatibleSpeechProviderOptions<
  ExtraConfig extends Record<string, unknown> = Record<string, never>,
> = {
  id: string;
  label: string;
  autoSelectOrder: number;
  models: readonly string[];
  voices: readonly string[];
  defaultModel: string;
  defaultVoice: string;
  defaultBaseUrl: string;
  envKey: string;
  responseFormats: readonly string[];
  defaultResponseFormat: string;
  voiceCompatibleResponseFormats: readonly string[];
  normalizeModel?: (value: string | undefined, fallback: string) => string;
  configKey?: string;
  extraHeaders?: Record<string, string>;
  readExtraConfig?: (raw: Record<string, unknown> | undefined) => ExtraConfig;
  missingApiKeyError?: string;
  apiErrorLabel?: string;
};

function normalizeResponseFormat(params: {
  providerLabel: string;
  responseFormats: readonly string[];
  value: unknown;
}): string | undefined {
  const next = normalizeLowercaseStringOrEmpty(params.value);
  if (!next) {
    return undefined;
  }
  if (params.responseFormats.includes(next)) {
    return next;
  }
  throw new Error(`Invalid ${params.providerLabel} speech responseFormat: ${next}`);
}

function responseFormatToFileExtension(format: string): `.${string}` {
  return `.${format}`;
}

function resolveProviderConfigRecord(
  rawConfig: Record<string, unknown>,
  providerConfigKey: string,
): Record<string, unknown> | undefined {
  const providers = asObject(rawConfig.providers);
  return asObject(providers?.[providerConfigKey]) ?? asObject(rawConfig[providerConfigKey]);
}

function readSpeechOverrides(overrides: SpeechProviderOverrides | undefined): {
  model?: string;
  voice?: string;
  speed?: number;
} {
  return {
    model: trimToUndefined(overrides?.model ?? overrides?.modelId),
    voice: trimToUndefined(overrides?.voice ?? overrides?.voiceId),
    speed: asFiniteNumber(overrides?.speed),
  };
}

function parseDirectiveToken(
  ctx: SpeechDirectiveTokenParseContext,
  providerConfigKey: string,
): { handled: boolean; overrides?: SpeechProviderOverrides } {
  const compactProviderKey = providerConfigKey.replace(/[^a-z0-9]+/giu, "").toLowerCase();
  switch (ctx.key) {
    case "voice":
    case "voice_id":
    case "voiceid":
    case `${providerConfigKey}_voice`:
    case `${compactProviderKey}voice`:
      return ctx.policy.allowVoice ? { handled: true, overrides: { voice: ctx.value } } : { handled: true };
    case "model":
    case "model_id":
    case "modelid":
    case `${providerConfigKey}_model`:
    case `${compactProviderKey}model`:
      return ctx.policy.allowModelId ? { handled: true, overrides: { model: ctx.value } } : { handled: true };
    default:
      return { handled: false };
  }
}

export function createOpenAiCompatibleSpeechProvider<
  ExtraConfig extends Record<string, unknown> = Record<string, never>,
>(options: OpenAiCompatibleSpeechProviderOptions<ExtraConfig>): SpeechProviderPlugin {
  const providerConfigKey = options.configKey ?? options.id;
  const normalizeModel =
    options.normalizeModel ?? ((value, fallback) => trimToUndefined(value) ?? fallback);
  const readExtraConfig = options.readExtraConfig ?? (() => ({}) as ExtraConfig);

  function normalizeConfig(
    rawConfig: Record<string, unknown>,
  ): OpenAiCompatibleSpeechProviderConfig<ExtraConfig> {
    const raw = resolveProviderConfigRecord(rawConfig, providerConfigKey);
    return {
      apiKey: trimToUndefined(raw?.apiKey),
      baseUrl: trimToUndefined(raw?.baseUrl),
      model: normalizeModel(trimToUndefined(raw?.model ?? raw?.modelId), options.defaultModel),
      voice: trimToUndefined(raw?.voice ?? raw?.voiceId) ?? options.defaultVoice,
      speed: asFiniteNumber(raw?.speed),
      responseFormat: normalizeResponseFormat({
        providerLabel: options.label,
        responseFormats: options.responseFormats,
        value: raw?.responseFormat,
      }),
      ...readExtraConfig(raw),
    };
  }

  function readProviderConfig(
    config: SpeechProviderConfig,
  ): OpenAiCompatibleSpeechProviderConfig<ExtraConfig> {
    return { ...normalizeConfig({}), ...normalizeConfig({ [providerConfigKey]: config }) };
  }

  return {
    id: options.id,
    label: options.label,
    autoSelectOrder: options.autoSelectOrder,
    models: [...options.models],
    voices: [...options.voices],
    resolveConfig: ({ rawConfig }) => normalizeConfig(rawConfig),
    parseDirectiveToken: (ctx) => parseDirectiveToken(ctx, providerConfigKey),
    listVoices: async () => options.voices.map((voice) => ({ id: voice, name: voice })),
    isConfigured: ({ providerConfig }) =>
      Boolean(readProviderConfig(providerConfig).apiKey ?? trimToUndefined(process.env[options.envKey])),
    synthesize: async (req) => {
      const config = readProviderConfig(req.providerConfig);
      const overrides = readSpeechOverrides(req.providerOverrides);
      const apiKey = config.apiKey ?? trimToUndefined(process.env[options.envKey]);
      if (!apiKey) {
        throw new Error(options.missingApiKeyError ?? `${options.label} API key missing`);
      }
      const responseFormat = config.responseFormat ?? options.defaultResponseFormat;
      const headers = new Headers({
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...options.extraHeaders,
      });
      const { response, release } = await postJsonRequest({
        url: `${(config.baseUrl ?? options.defaultBaseUrl).replace(/\/+$/u, "")}/audio/speech`,
        headers,
        body: {
          model: normalizeModel(overrides.model ?? config.model, options.defaultModel),
          input: req.text,
          voice: overrides.voice ?? config.voice,
          response_format: responseFormat,
          ...(overrides.speed ?? config.speed == null
            ? {}
            : { speed: overrides.speed ?? config.speed }),
        },
        timeoutMs: req.timeoutMs,
        fetchFn: fetch,
      });
      try {
        await assertOkOrThrowHttpError(
          response,
          options.apiErrorLabel ?? `${options.label} TTS API error`,
        );
        return {
          audioBuffer: Buffer.from(await response.arrayBuffer()),
          outputFormat: responseFormat,
          fileExtension: responseFormatToFileExtension(responseFormat),
          voiceCompatible: options.voiceCompatibleResponseFormats.includes(responseFormat),
        };
      } finally {
        await release();
      }
    },
  };
}
