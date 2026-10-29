// Stub for @grammyjs/transformer-throttler — used by extensions/telegram
export class Throttler {
  constructor() {}
  transformer() { return (ctx: unknown, next: () => unknown) => next(); }
}

export function apiThrottler(_options?: unknown) {
  return (prev: unknown, method: string, payload: unknown, signal: unknown) => {};
}

export default Throttler;
