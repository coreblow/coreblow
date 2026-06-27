// Public web-fetch registration helpers for provider plugins.
// Note: WebFetchProviderPlugin, WebFetchCredentialResolutionSource,
// WebFetchProviderToolDefinition, and withSelfHostedWebToolsEndpoint
// do not exist in CoreBlow (intentionally different: CB consolidates web
// provider tooling under the WebSearch plugin contract).

export { jsonResult, readNumberParam, readStringParam } from "../agents/tools/common.js";
export {
  withStrictWebToolsEndpoint,
  withTrustedWebToolsEndpoint,
} from "../agents/tools/web-guarded-fetch.js";
export { markdownToText, normalizeWhitespace, truncateText } from "../agents/tools/web-fetch-utils.js";
export {
  DEFAULT_CACHE_TTL_MINUTES,
  DEFAULT_TIMEOUT_SECONDS,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  resolveTimeoutSeconds,
  writeCache,
} from "../agents/tools/web-shared.js";
export { enablePluginInConfig } from "../plugins/enable.js";
export { wrapExternalContent, wrapWebContent } from "../security/external-content.js";
