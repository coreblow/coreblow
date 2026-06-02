import { enablePluginInConfig } from "coreblow/plugin-sdk/provider-web-search";
import {
  FIRECRAWL_WEB_FETCH_PROVIDER_SHARED,
  type FirecrawlWebFetchProviderPlugin,
} from "./src/firecrawl-fetch-provider-shared.js";

export function createFirecrawlWebFetchProvider(): FirecrawlWebFetchProviderPlugin {
  return {
    ...FIRECRAWL_WEB_FETCH_PROVIDER_SHARED,
    applySelectionConfig: (config) => enablePluginInConfig(config, "firecrawl").config,
    createTool: () => null,
  };
}
