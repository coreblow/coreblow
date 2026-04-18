/** CoreBlow — PI Model Provider Normalization */ export function normalizeProvider(provider: string): string { return provider.toLowerCase().replace(/ /g, "-"); }
