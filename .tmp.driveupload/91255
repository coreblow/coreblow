/** PI embedded error observation. */
export interface ErrorObservation { error: string; provider: string; model: string; timestamp: number; retryable: boolean; }
export function createErrorObservation(error: string, provider: string, model: string, retryable = false): ErrorObservation { return { error, provider, model, timestamp: Date.now(), retryable }; }
