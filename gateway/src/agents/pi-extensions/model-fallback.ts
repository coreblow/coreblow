/** CoreBlow — PI Model Fallback */ export function selectFallbackModel(primary: string, fallbacks: string[]): string { return fallbacks[0] ?? primary; }
