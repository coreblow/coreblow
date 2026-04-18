// Stub for @grammyjs/transformer-throttler — used by extensions/telegram
export class Throttler {
  constructor() {}
  transformer() { return (ctx: unknown, next: () => unknown) => next(); }
}
export default Throttler;
