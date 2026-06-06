import type { AuthProfileStore } from "../agents/auth-profiles/types.js";
import type { FallbackAttempt } from "../agents/model-fallback.types.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { SsrFPolicy } from "../infra/net/ssrf.js";
import type {
  GeneratedImageAsset,
  ImageGenerationBackground,
  ImageGenerationIgnoredOverride,
  ImageGenerationNormalization,
  ImageGenerationOutputFormat,
  ImageGenerationProvider,
  ImageGenerationProviderOptions,
  ImageGenerationQuality,
  ImageGenerationResolution,
  ImageGenerationSourceImage,
} from "./types.js";

export type GenerateImageParams = {
  cfg: CoreBlowConfig;
  prompt: string;
  agentDir?: string;
  authStore?: AuthProfileStore;
  modelOverride?: string;
  count?: number;
  size?: string;
  aspectRatio?: string;
  resolution?: ImageGenerationResolution;
  quality?: ImageGenerationQuality;
  outputFormat?: ImageGenerationOutputFormat;
  background?: ImageGenerationBackground;
  inputImages?: ImageGenerationSourceImage[];
  autoProviderFallback?: boolean;
  timeoutMs?: number;
  providerOptions?: ImageGenerationProviderOptions;
  ssrfPolicy?: SsrFPolicy;
};

export type GenerateImageRuntimeResult = {
  images: GeneratedImageAsset[];
  provider: string;
  model: string;
  attempts: FallbackAttempt[];
  normalization?: ImageGenerationNormalization;
  metadata?: Record<string, unknown>;
  ignoredOverrides: ImageGenerationIgnoredOverride[];
};

export type ListRuntimeImageGenerationProvidersParams = {
  config?: CoreBlowConfig;
};

export type RuntimeImageGenerationProvider = ImageGenerationProvider;
