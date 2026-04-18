/**
 * CoreBlow — Fetch Wrapper
 *
 * Centralized HTTP fetch with timeout management, retry support,
 * and structured error handling. Builds on top of globalThis.fetch.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CoreBlowFetchOptions {
  /** Request URL */
  url: string;
  /** HTTP method. Default: 'GET' */
  method?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: string | Buffer | ReadableStream;
  /** Timeout in ms. Default: 30_000 */
  timeoutMs?: number;
  /** External abort signal to compose with timeout */
  signal?: AbortSignal;
  /** Additional fetch init options */
  init?: Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;
}

export interface CoreBlowFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  /** Parsed JSON body. Null if response is not JSON. */
  json: <T = unknown>() => Promise<T>;
  /** Raw text body */
  text: () => Promise<string>;
  /** Raw Response object for streaming or advanced use */
  raw: Response;
}

export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Fetch timeout after ${timeoutMs}ms: ${url}`);
    this.name = 'FetchTimeoutError';
  }
}

export class FetchNetworkError extends Error {
  public readonly cause: unknown;
  constructor(url: string, cause: unknown) {
    super(`Fetch network error: ${url} — ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'FetchNetworkError';
    this.cause = cause;
  }
}

// ─── Abort Signal Composition ───────────────────────────────────────────────

interface ComposedSignal {
  signal: AbortSignal;
  cleanup: () => void;
}

function composeAbortSignal(timeoutMs: number, external?: AbortSignal): ComposedSignal {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
    timer = setTimeout(() => controller.abort(new FetchTimeoutError('', timeoutMs)), timeoutMs);
  }

  if (external) {
    if (external.aborted) {
      controller.abort(external.reason);
    } else {
      const onAbort = () => controller.abort(external.reason);
      external.addEventListener('abort', onAbort, { once: true });
      const originalCleanup = () => external.removeEventListener('abort', onAbort);
      return {
        signal: controller.signal,
        cleanup: () => {
          if (timer) clearTimeout(timer);
          originalCleanup();
        },
      };
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer) clearTimeout(timer);
    },
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Make an HTTP request with timeout and structured error handling.
 */
export async function coreblowFetch(options: CoreBlowFetchOptions): Promise<CoreBlowFetchResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const { signal, cleanup } = composeAbortSignal(timeoutMs, options.signal);

  try {
    const response = await globalThis.fetch(options.url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body as any,
      signal,
      ...options.init,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      json: <T = unknown>() => response.json() as Promise<T>,
      text: () => response.text(),
      raw: response,
    };
  } catch (err) {
    if (err instanceof FetchTimeoutError) throw err;
    if (signal.aborted) {
      const reason = signal.reason;
      if (reason instanceof FetchTimeoutError) {
        throw new FetchTimeoutError(options.url, timeoutMs);
      }
      throw reason instanceof Error ? reason : new Error('Fetch aborted');
    }
    throw new FetchNetworkError(options.url, err);
  } finally {
    cleanup();
  }
}

/**
 * Convenience wrapper for JSON API calls.
 * Automatically sets Accept and Content-Type headers.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options?: Omit<CoreBlowFetchOptions, 'url'>,
): Promise<T> {
  const result = await coreblowFetch({
    ...options,
    url,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!result.ok) {
    const body = await result.text().catch(() => '');
    throw new Error(`HTTP ${result.status} ${result.statusText}: ${body.slice(0, 500)}`);
  }

  return result.json<T>();
}
