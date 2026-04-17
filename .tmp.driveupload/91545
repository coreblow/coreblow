/** PI tool abort handling. */
export function createAbortController(timeoutMs?: number): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController();
    const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
    return { controller, cleanup: () => { if (timer) clearTimeout(timer); } };
}
