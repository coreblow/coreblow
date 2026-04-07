/** Handler type definitions. */
export type HandlerResult = { handled: boolean; shouldContinue: boolean; };
export function createHandlerResult(handled: boolean, shouldContinue = true): HandlerResult { return { handled, shouldContinue }; }
