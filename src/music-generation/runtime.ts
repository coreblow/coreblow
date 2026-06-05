import type { FallbackAttempt } from "../agents/model-fallback.types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  buildMediaGenerationNormalizationMetadata,
  recordCapabilityCandidateFailure,
  resolveCapabilityModelCandidates,
  throwCapabilityGenerationFailure,
} from "../media-generation/runtime-shared.js";
import { parseMusicGenerationModelRef } from "./model-ref.js";
import { resolveMusicGenerationOverrides } from "./normalization.js";
import { getMusicGenerationProvider, listMusicGenerationProviders } from "./provider-registry.js";
import type { GenerateMusicParams, GenerateMusicRuntimeResult } from "./runtime-types.js";
import type { MusicGenerationResult } from "./types.js";

const log = createSubsystemLogger("music-generation");

export type MusicGenerationRuntimeDeps = {
  getProvider?: typeof getMusicGenerationProvider;
  listProviders?: typeof listMusicGenerationProviders;
  getProviderEnvVars?: (provider: string) => readonly string[];
  log?: Pick<typeof log, "debug">;
};

export type { GenerateMusicParams, GenerateMusicRuntimeResult } from "./runtime-types.js";

function resolveMusicGenerationModelConfig(cfg: GenerateMusicParams["cfg"]) {
  return (cfg.agents?.defaults as { musicGenerationModel?: unknown } | undefined)
    ?.musicGenerationModel as Parameters<typeof resolveCapabilityModelCandidates>[0]["modelConfig"];
}

function resolveMusicGenerationTimeoutMs(cfg: GenerateMusicParams["cfg"]): number | undefined {
  const raw = (cfg.agents?.defaults as { musicGenerationModel?: { timeoutMs?: unknown } } | undefined)
    ?.musicGenerationModel?.timeoutMs;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
}

function buildNoMusicGenerationModelConfiguredMessage(params: {
  providers: ReturnType<typeof listMusicGenerationProviders>;
}): string {
  const providerIds = params.providers.map((provider) => provider.id).sort();
  const suffix =
    providerIds.length > 0
      ? ` Available providers: ${providerIds.join(", ")}.`
      : " No music-generation providers are currently registered.";
  return `No music-generation model configured. Set agents.defaults.musicGenerationModel, for example google/lyria-3-clip-preview.${suffix}`;
}

export function listRuntimeMusicGenerationProviders(
  params?: { config?: GenerateMusicParams["cfg"] },
  deps: MusicGenerationRuntimeDeps = {},
) {
  return (deps.listProviders ?? listMusicGenerationProviders)(params?.config);
}

export async function generateMusic(
  params: GenerateMusicParams,
  deps: MusicGenerationRuntimeDeps = {},
): Promise<GenerateMusicRuntimeResult> {
  const getProvider = deps.getProvider ?? getMusicGenerationProvider;
  const listProviders = deps.listProviders ?? listMusicGenerationProviders;
  const logger = deps.log ?? log;
  const modelConfig = resolveMusicGenerationModelConfig(params.cfg);
  const timeoutMs = params.timeoutMs ?? resolveMusicGenerationTimeoutMs(params.cfg);
  const candidates = resolveCapabilityModelCandidates({
    cfg: params.cfg,
    modelConfig,
    modelOverride: params.modelOverride,
    parseModelRef: parseMusicGenerationModelRef,
    agentDir: params.agentDir,
    listProviders,
    autoProviderFallback: params.autoProviderFallback,
  });
  if (candidates.length === 0) {
    throw new Error(
      buildNoMusicGenerationModelConfiguredMessage({
        providers: listProviders(params.cfg),
      }),
    );
  }

  const attempts: FallbackAttempt[] = [];
  let lastError: unknown;

  for (const candidate of candidates) {
    const provider = getProvider(candidate.provider, params.cfg);
    if (!provider) {
      const error = `No music-generation provider registered for ${candidate.provider}`;
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        error,
      });
      lastError = new Error(error);
      continue;
    }

    try {
      const sanitized = resolveMusicGenerationOverrides({
        provider,
        model: candidate.model,
        lyrics: params.lyrics,
        instrumental: params.instrumental,
        durationSeconds: params.durationSeconds,
        format: params.format,
        inputImages: params.inputImages,
      });
      const result: MusicGenerationResult = await provider.generateMusic({
        provider: candidate.provider,
        model: candidate.model,
        prompt: params.prompt,
        cfg: params.cfg,
        agentDir: params.agentDir,
        authStore: params.authStore,
        lyrics: sanitized.lyrics,
        instrumental: sanitized.instrumental,
        durationSeconds: sanitized.durationSeconds,
        format: sanitized.format,
        inputImages: params.inputImages,
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      });
      if (!Array.isArray(result.tracks) || result.tracks.length === 0) {
        throw new Error("Music generation provider returned no tracks.");
      }
      return {
        tracks: result.tracks,
        provider: candidate.provider,
        model: result.model ?? candidate.model,
        attempts,
        lyrics: result.lyrics,
        normalization: sanitized.normalization,
        metadata: {
          ...result.metadata,
          ...buildMediaGenerationNormalizationMetadata({
            normalization: sanitized.normalization,
          }),
        },
        ignoredOverrides: sanitized.ignoredOverrides,
      };
    } catch (err) {
      lastError = err;
      recordCapabilityCandidateFailure({
        attempts,
        provider: candidate.provider,
        model: candidate.model,
        error: err,
      });
      logger.debug(`music-generation candidate failed: ${candidate.provider}/${candidate.model}`);
    }
  }

  return throwCapabilityGenerationFailure({
    capabilityLabel: "music generation",
    attempts,
    lastError,
  });
}
