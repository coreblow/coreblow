/** CoreBlow — Context Pruning Tools */ export function shouldPruneToolResults(tokenCount: number, threshold = 50000): boolean { return tokenCount > threshold; }
