/** Model reference profiles. */
export interface ModelRefProfile { modelId: string; provider: string; profileId?: string; }
export function parseModelRef(ref: string): ModelRefProfile { const [provider, ...rest] = ref.split('/'); return { provider, modelId: rest.join('/') || provider }; }
