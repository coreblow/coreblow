import type { AuthProfileStore } from "../agents/auth-profiles.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { SsrFPolicy } from "../infra/net/ssrf.js";

export type GeneratedImageAsset = {
  buffer: Buffer;
  url?: string;
  base64?: string;
  width?: number;
  height?: number;
  mimeType: string;
  fileName?: string;
  revisedPrompt?: string;
  metadata?: Record<string, unknown>;
};

export type ImageGenerationResolution = "1K" | "2K" | "4K";

export type ImageGenerationQuality = "auto" | "standard" | "hd" | "low" | "medium" | "high";

export type ImageGenerationOutputFormat = "png" | "jpeg" | "webp";

export type ImageGenerationBackground = "auto" | "transparent" | "opaque";

export type ImageGenerationIgnoredOverride = {
  key: string;
  value: string | number | boolean;
};

export type ImageGenerationNormalization = {
  size?: {
    requested?: string;
    applied?: string;
    derivedFrom?: string;
  };
  aspectRatio?: {
    requested?: string;
    applied?: string;
    derivedFrom?: string;
  };
  resolution?: {
    requested?: ImageGenerationResolution;
    applied?: ImageGenerationResolution;
    derivedFrom?: string;
  };
};

export type ImageGenerationSourceImage = {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
};

export type ImageGenerationRequest = {
  provider: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  style?: string;
  cfg: CoreBlowConfig;
  agentDir?: string;
  authStore?: AuthProfileStore;
  timeoutMs?: number;
  count?: number;
  size?: string;
  aspectRatio?: string;
  resolution?: ImageGenerationResolution;
  quality?: ImageGenerationQuality;
  outputFormat?: ImageGenerationOutputFormat;
  background?: ImageGenerationBackground;
  inputImages?: ImageGenerationSourceImage[];
  ssrfPolicy?: SsrFPolicy;
};

export type ImageGenerationResult = {
  images: GeneratedImageAsset[];
  model?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ImageGenerationModeCapabilities = {
  maxCount?: number;
  supportsSize?: boolean;
  supportsAspectRatio?: boolean;
  supportsResolution?: boolean;
};

export type ImageGenerationEditCapabilities = ImageGenerationModeCapabilities & {
  enabled: boolean;
  maxInputImages?: number;
};

export type ImageGenerationGeometryCapabilities = {
  sizes?: string[];
  aspectRatios?: string[];
  resolutions?: ImageGenerationResolution[];
};

export type ImageGenerationOutputCapabilities = {
  qualities?: ImageGenerationQuality[];
  formats?: ImageGenerationOutputFormat[];
  backgrounds?: ImageGenerationBackground[];
};

export type ImageGenerationProviderCapabilities = {
  generate: ImageGenerationModeCapabilities;
  edit: ImageGenerationEditCapabilities;
  geometry?: ImageGenerationGeometryCapabilities;
  output?: ImageGenerationOutputCapabilities;
  sizes?: string[];
  aspectRatios?: string[];
  maxCount?: number;
  negativePrompt?: boolean;
  styles?: string[];
  qualities?: ImageGenerationQuality[];
  [key: string]: unknown;
};

export type ImageGenerationProvider = {
  id: string;
  aliases?: string[];
  label?: string;
  name?: string;
  defaultModel?: string;
  models?: string[];
  capabilities: ImageGenerationProviderCapabilities | any;
  isConfigured?: (ctx: { cfg?: CoreBlowConfig; agentDir?: string }) => boolean;
  generateImage: (req: ImageGenerationRequest) => Promise<ImageGenerationResult>;
  [key: string]: unknown;
};

export type ImageGenerationProviderOptions = Record<string, unknown>;

// Capabilities interface matching provider implementations
export type ImageGenerationCapabilities = ImageGenerationProviderCapabilities;
