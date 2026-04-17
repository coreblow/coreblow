/** PI tool parameter extraction. */
export function extractParam<T>(input: Record<string, unknown>, key: string, fallback: T): T { return (input[key] as T) ?? fallback; }
export function requireParam(input: Record<string, unknown>, key: string): unknown { const val = input[key]; if (val === undefined) throw new Error(`Missing required param: ${key}`); return val; }
