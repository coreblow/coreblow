/** PI model discovery — enumerate available models. */
export interface DiscoveredModel { id: string; provider: string; contextWindow: number; }
export async function discoverModels(provider: string, apiKey: string): Promise<DiscoveredModel[]> { return []; /* implement per provider */ }
