export type MediaGenerationCatalogKind =
  | "image_generation"
  | "video_generation"
  | "music_generation";

export type MediaGenerationCatalogSource = "static" | "live" | "cache" | "configured";

export type MediaGenerationCatalogEntry<TCapabilities = unknown> = {
  kind: MediaGenerationCatalogKind;
  provider: string;
  model: string;
  source: MediaGenerationCatalogSource;
  label?: string;
  default?: boolean;
  capabilities: TCapabilities;
  modes?: readonly string[];
};

export type MediaGenerationCatalogProvider<TCapabilities = unknown> = {
  id: string;
  aliases?: readonly string[];
  label?: string;
  defaultModel?: string;
  models?: readonly string[];
  capabilities: TCapabilities;
};

function uniqueModels(provider: { defaultModel?: string; models?: readonly string[] }): string[] {
  const seen = new Set<string>();
  const models: string[] = [];
  for (const candidate of [provider.defaultModel, ...(provider.models ?? [])]) {
    const model = candidate?.trim();
    if (!model || seen.has(model)) {
      continue;
    }
    seen.add(model);
    models.push(model);
  }
  return models;
}

export function synthesizeMediaGenerationCatalogEntries<TCapabilities>(params: {
  kind: MediaGenerationCatalogKind;
  provider: MediaGenerationCatalogProvider<TCapabilities>;
  modes?: readonly string[];
}): Array<MediaGenerationCatalogEntry<TCapabilities>> {
  return uniqueModels(params.provider).map((model) => ({
    kind: params.kind,
    provider: params.provider.id,
    model,
    source: "static",
    capabilities: params.provider.capabilities,
    ...(params.provider.label ? { label: params.provider.label } : {}),
    ...(model === params.provider.defaultModel ? { default: true } : {}),
    ...(params.modes ? { modes: params.modes } : {}),
  }));
}

export function listMediaGenerationProviderModels(provider: {
  defaultModel?: string;
  models?: readonly string[];
}): string[] {
  return uniqueModels(provider);
}
