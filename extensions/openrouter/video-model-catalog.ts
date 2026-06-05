export type OpenRouterVideoModelCatalogEntry = {
  id: string;
  label: string;
  durations: readonly number[];
  aspectRatios: readonly string[];
  resolutions: readonly string[];
  supportsAudio: boolean;
};

export const OPENROUTER_VIDEO_MODEL_CATALOG = [
  {
    id: "google/veo-3.1-fast",
    label: "Google Veo 3.1 Fast",
    durations: [4, 6, 8],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720P", "1080P"],
    supportsAudio: true,
  },
  {
    id: "google/veo-3.1",
    label: "Google Veo 3.1",
    durations: [4, 6, 8],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720P", "1080P"],
    supportsAudio: true,
  },
] as const satisfies readonly OpenRouterVideoModelCatalogEntry[];

export const DEFAULT_OPENROUTER_VIDEO_MODEL = OPENROUTER_VIDEO_MODEL_CATALOG[0].id;

export function listOpenRouterVideoModelCatalog(): OpenRouterVideoModelCatalogEntry[] {
  return OPENROUTER_VIDEO_MODEL_CATALOG.map((entry) => ({
    ...entry,
    durations: [...entry.durations],
    aspectRatios: [...entry.aspectRatios],
    resolutions: [...entry.resolutions],
  }));
}
