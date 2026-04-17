/**
 * agents/model-suppression.ts
 * Suppress specific models from being used.
 */
const suppressedModels = new Set<string>();
export function suppressModel(modelId: string): void { suppressedModels.add(modelId); }
export function unsuppressModel(modelId: string): void { suppressedModels.delete(modelId); }
export function isModelSuppressed(modelId: string): boolean { return suppressedModels.has(modelId); }
export function listSuppressedModels(): string[] { return [...suppressedModels]; }
export function clearSuppressedModels(): void { suppressedModels.clear(); }
