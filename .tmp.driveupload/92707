/**
 * auto-reply/reply/model-selection.ts
 * Model selection logic for the auto-reply subsystem.
 */

export interface ModelSelectionCriteria {
    channel?: string;
    complexity?: 'low' | 'medium' | 'high';
    budget?: 'economy' | 'standard' | 'premium';
}

export interface ModelSelection {
    provider: string;
    model: string;
    reason: string;
}

const MODEL_TIERS: Record<string, ModelSelection> = {
    economy: { provider: 'openai', model: 'gpt-4o-mini', reason: 'economy tier' },
    standard: { provider: 'openai', model: 'gpt-4o', reason: 'standard tier' },
    premium: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', reason: 'premium tier' },
};

export function selectModel(criteria?: ModelSelectionCriteria): ModelSelection {
    const budget = criteria?.budget ?? 'standard';
    return MODEL_TIERS[budget] ?? MODEL_TIERS.standard!;
}

export function listAvailableModels(): ModelSelection[] {
    return Object.values(MODEL_TIERS);
}
