import {
  hasMediaNormalizationEntry,
  resolveClosestAspectRatio,
  resolveClosestResolution,
  resolveClosestSize,
} from "../media-generation/runtime-shared.js";
import type {
  ImageGenerationBackground,
  ImageGenerationIgnoredOverride,
  ImageGenerationNormalization,
  ImageGenerationOutputFormat,
  ImageGenerationProvider,
  ImageGenerationQuality,
  ImageGenerationResolution,
  ImageGenerationSourceImage,
} from "./types.js";

type ResolvedImageGenerationOverrides = {
  size?: string;
  aspectRatio?: string;
  resolution?: ImageGenerationResolution;
  quality?: ImageGenerationQuality;
  outputFormat?: ImageGenerationOutputFormat;
  background?: ImageGenerationBackground;
  ignoredOverrides: ImageGenerationIgnoredOverride[];
  normalization?: ImageGenerationNormalization;
};

function finalizeImageNormalization(
  normalization: ImageGenerationNormalization,
): ImageGenerationNormalization | undefined {
  return hasMediaNormalizationEntry(normalization.size) ||
    hasMediaNormalizationEntry(normalization.aspectRatio) ||
    hasMediaNormalizationEntry(normalization.resolution)
    ? normalization
    : undefined;
}

export function resolveImageGenerationOverrides(params: {
  provider: ImageGenerationProvider;
  size?: string;
  aspectRatio?: string;
  resolution?: ImageGenerationResolution;
  quality?: ImageGenerationQuality;
  outputFormat?: ImageGenerationOutputFormat;
  background?: ImageGenerationBackground;
  inputImages?: ImageGenerationSourceImage[];
}): ResolvedImageGenerationOverrides {
  const hasInputImages = (params.inputImages?.length ?? 0) > 0;
  const modeCaps = hasInputImages
    ? params.provider.capabilities.edit
    : params.provider.capabilities.generate;
  const geometry = params.provider.capabilities.geometry;
  const ignoredOverrides: ImageGenerationIgnoredOverride[] = [];
  const normalization: ImageGenerationNormalization = {};

  let size = params.size;
  let aspectRatio = params.aspectRatio;
  let resolution = params.resolution;
  let quality = params.quality;
  let outputFormat = params.outputFormat;
  let background = params.background;

  if (size && modeCaps.supportsSize && (geometry?.sizes?.length ?? 0) > 0) {
    const applied = resolveClosestSize({ requestedSize: size, supportedSizes: geometry?.sizes });
    if (applied && applied !== size) {
      normalization.size = { requested: size, applied };
    }
    size = applied;
  } else if (size && !modeCaps.supportsSize) {
    if (modeCaps.supportsAspectRatio) {
      const applied = resolveClosestAspectRatio({
        requestedAspectRatio: aspectRatio,
        requestedSize: size,
        supportedAspectRatios: geometry?.aspectRatios,
      });
      if (applied) {
        aspectRatio = applied;
        normalization.aspectRatio = { applied, derivedFrom: "size" };
      } else {
        ignoredOverrides.push({ key: "size", value: size });
      }
    } else {
      ignoredOverrides.push({ key: "size", value: size });
    }
    size = undefined;
  }

  if (aspectRatio && modeCaps.supportsAspectRatio && (geometry?.aspectRatios?.length ?? 0) > 0) {
    const applied = resolveClosestAspectRatio({
      requestedAspectRatio: aspectRatio,
      requestedSize: size,
      supportedAspectRatios: geometry?.aspectRatios,
    });
    if (applied && applied !== aspectRatio) {
      normalization.aspectRatio = { requested: aspectRatio, applied };
    }
    aspectRatio = applied;
  } else if (aspectRatio && !modeCaps.supportsAspectRatio) {
    ignoredOverrides.push({ key: "aspectRatio", value: aspectRatio });
    aspectRatio = undefined;
  }

  if (resolution && modeCaps.supportsResolution && (geometry?.resolutions?.length ?? 0) > 0) {
    const applied = resolveClosestResolution({
      requestedResolution: resolution,
      supportedResolutions: geometry?.resolutions,
    });
    if (applied && applied !== resolution) {
      normalization.resolution = { requested: resolution, applied };
    }
    resolution = applied;
  } else if (resolution && !modeCaps.supportsResolution) {
    ignoredOverrides.push({ key: "resolution", value: resolution });
    resolution = undefined;
  }

  if (quality && !(params.provider.capabilities.output?.qualities ?? []).includes(quality)) {
    ignoredOverrides.push({ key: "quality", value: quality });
    quality = undefined;
  }
  if (outputFormat && !(params.provider.capabilities.output?.formats ?? []).includes(outputFormat)) {
    ignoredOverrides.push({ key: "outputFormat", value: outputFormat });
    outputFormat = undefined;
  }
  if (background && !(params.provider.capabilities.output?.backgrounds ?? []).includes(background)) {
    ignoredOverrides.push({ key: "background", value: background });
    background = undefined;
  }

  return {
    size,
    aspectRatio,
    resolution,
    quality,
    outputFormat,
    background,
    ignoredOverrides,
    normalization: finalizeImageNormalization(normalization),
  };
}
