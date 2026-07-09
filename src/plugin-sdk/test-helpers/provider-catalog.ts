export {
  expectAugmentedCodexCatalog,
  expectedAugmentedOpenaiCodexCatalogEntries,
  expectCodexMissingAuthHint,
} from "../testing.js";
export type { ProviderPlugin } from "../provider-model-shared.js";
export {
  loadBundledPluginPublicSurface,
  loadBundledPluginPublicSurfaceSync,
} from "./public-surface-loader.js";

type ProviderRuntimeCatalogModule = Pick<
  typeof import("coreblow/plugin-sdk/provider-catalog-runtime"),
  "augmentModelCatalogWithProviderPlugins"
>;

export async function importProviderRuntimeCatalogModule(): Promise<ProviderRuntimeCatalogModule> {
  const { augmentModelCatalogWithProviderPlugins } =
    await import("coreblow/plugin-sdk/provider-catalog-runtime");
  return {
    augmentModelCatalogWithProviderPlugins,
  };
}
