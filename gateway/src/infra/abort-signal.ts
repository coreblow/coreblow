/**
 * CoreBlow — Abort Signal Utilities
 *
 * Helpers for working with AbortSignal instances,
 * enabling clean cancellation of async operations.
 *
 * @packageDocumentation
 */

/**
 * Returns a promise that resolves when the given AbortSignal is aborted.
 * If the signal is already aborted or undefined, resolves immediately.
 */
export async function waitForAbortSignal(signal?: AbortSignal): Promise<void> {
  if (!signal || signal.aborted) {
    return;
  }
  await new Promise<void>((resolve) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Creates a linked AbortController that aborts when any of the
 * parent signals abort. Useful for composing cancellation scopes.
 */
export function createLinkedAbortController(
  ...parentSignals: (AbortSignal | undefined)[]
): AbortController {
  const controller = new AbortController();
  for (const parent of parentSignals) {
    if (!parent) continue;
    if (parent.aborted) {
      controller.abort(parent.reason);
      return controller;
    }
    parent.addEventListener(
      'abort',
      () => controller.abort(parent.reason),
      { once: true, signal: controller.signal },
    );
  }
  return controller;
}

/**
 * Creates an AbortSignal that fires after the given timeout in milliseconds.
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}
