/** Provider policy configuration. */
export interface ProviderPolicy { maxRequestsPerMinute?: number; maxConcurrent?: number; allowStreaming?: boolean; }
export const DEFAULT_PROVIDER_POLICY: ProviderPolicy = { maxRequestsPerMinute: 60, maxConcurrent: 5, allowStreaming: true };
