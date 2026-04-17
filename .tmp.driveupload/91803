/**
 * CoreBlow — Error Boundary
 *
 * Simple error logging for catch blocks.
 * Replaces silent `catch {}` with observable `catch (e) { logCaughtError(...) }`.
 *
 * Self-host pattern: stderr output so user sees it in terminal / docker logs.
 * NOT a structured logger — no Loki, no CloudWatch, no JSON.
 */

/**
 * Log a caught error to stderr with module context.
 * Use this instead of silent `catch {}` blocks.
 */
export function logCaughtError(module: string, error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);
    const ts = new Date().toISOString();
    process.stderr.write(`[${ts}] [${module}] ERROR: ${msg}\n`);
}

/**
 * Log a caught error and return a fallback value.
 * Useful for `readJsonFile`-style patterns.
 */
export function logAndReturn<T>(module: string, error: unknown, fallback: T): T {
    logCaughtError(module, error);
    return fallback;
}
