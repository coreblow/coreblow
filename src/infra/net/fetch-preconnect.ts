export type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type FetchPreconnectOptions = {
  dns?: boolean;
  tcp?: boolean;
  http?: boolean;
  https?: boolean;
};

export type FetchWithPreconnect = {
  preconnect: (url: string | URL, options?: FetchPreconnectOptions) => void;
};

/**
 * Attaches a no-op `preconnect` helper matching Bun/Node fetch shapes for adapters and tests.
 */
export function withFetchPreconnect<T extends typeof fetch>(fn: T): T & FetchWithPreconnect;
export function withFetchPreconnect<T extends object>(
  fn: T,
): T & FetchWithPreconnect & typeof fetch;
export function withFetchPreconnect(fn: object) {
  return Object.assign(fn, {
    preconnect: (_url: string | URL, _options?: FetchPreconnectOptions) => {},
  });
}
