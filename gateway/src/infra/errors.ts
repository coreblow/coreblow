/**
 * CoreBlow — Error Utilities
 *
 * Standardised error extraction, formatting, and classification
 * used across the entire gateway runtime.
 *
 * @packageDocumentation
 */

/**
 * Extract the `.code` property from an error-like value.
 */
export function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string') return code;
  if (typeof code === 'number') return String(code);
  return undefined;
}

/**
 * Read the `.name` property from an error-like value, defaulting to ''.
 */
export function readErrorName(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' ? name : '';
}

/**
 * Walk an error graph (including nested causes) to collect all error candidates.
 * Useful for finding root-cause errors in complex error chains.
 */
export function collectErrorGraphCandidates(
  err: unknown,
  resolveNested?: (current: Record<string, unknown>) => Iterable<unknown>,
): unknown[] {
  const queue: unknown[] = [err];
  const seen = new Set<unknown>();
  const candidates: unknown[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null || seen.has(current)) continue;
    seen.add(current);
    candidates.push(current);

    if (!current || typeof current !== 'object' || !resolveNested) continue;
    for (const nested of resolveNested(current as Record<string, unknown>)) {
      if (nested != null && !seen.has(nested)) {
        queue.push(nested);
      }
    }
  }

  return candidates;
}

/**
 * Type guard for NodeJS.ErrnoException (any error with a `.code` property).
 */
export function isErrno(err: unknown): err is NodeJS.ErrnoException {
  return Boolean(err && typeof err === 'object' && 'code' in err);
}

/**
 * Check if an error has a specific errno code.
 */
export function hasErrnoCode(err: unknown, code: string): boolean {
  return isErrno(err) && err.code === code;
}

/**
 * Safely redact sensitive tokens from text before logging.
 * Matches common API key patterns and replaces them.
 */
function redactSensitiveText(text: string): string {
  // Redact bearer tokens, API keys, and secrets
  return text
    .replace(/(?:Bearer\s+)[A-Za-z0-9_\-.]+/gi, 'Bearer <redacted>')
    .replace(/(?:sk-|key-|api[-_]?key[=:]?\s*)[A-Za-z0-9_\-.]{8,}/gi, '<redacted-key>')
    .replace(/(?:password|secret|token)[=:]\s*\S+/gi, (match) => {
      const eqIdx = match.indexOf('=');
      const colonIdx = match.indexOf(':');
      const sepIdx = eqIdx >= 0 ? eqIdx : colonIdx;
      return sepIdx >= 0 ? `${match.slice(0, sepIdx + 1)} <redacted>` : '<redacted>';
    });
}

/**
 * Format any error value into a safe, human-readable message.
 */
export function formatErrorMessage(err: unknown): string {
  let formatted: string;
  if (err instanceof Error) {
    formatted = err.message || err.name || 'Error';
  } else if (typeof err === 'string') {
    formatted = err;
  } else if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    formatted = String(err);
  } else {
    try {
      formatted = JSON.stringify(err);
    } catch {
      formatted = Object.prototype.toString.call(err);
    }
  }
  return redactSensitiveText(formatted);
}

/**
 * Format an uncaught error with stack trace when available.
 */
export function formatUncaughtError(err: unknown): string {
  if (extractErrorCode(err) === 'INVALID_CONFIG') {
    return formatErrorMessage(err);
  }
  if (err instanceof Error) {
    const stack = err.stack ?? err.message ?? err.name;
    return redactSensitiveText(stack);
  }
  return formatErrorMessage(err);
}

/**
 * CoreBlow-specific error class for typed operational errors.
 */
export class CoreBlowError extends Error {
  public readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoreBlowError';
    this.code = code;
  }
}
