/** CoreBlow — Web Search Provider Config */ export function resolveSearchProvider(): string { return process.env.COREBLOW_SEARCH_PROVIDER || "duckduckgo"; }
