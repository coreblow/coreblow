// False gap: CoreBlow consolidated interactive state in interactive.ts
// RegisteredInteractiveHandler is a private type in interactive.ts
// dedupe/state management not exposed separately — inline here

export type RegisteredInteractiveHandler = {
  pluginId: string;
  namespace: string;
  handler: (...args: unknown[]) => unknown;
  interactiveHandlers: Map<string, RegisteredInteractiveHandler>;
};

const callbackDedupe = new Map<string, number>();

export function getPluginInteractiveHandlersState() {
  return { callbackDedupe: new Map(callbackDedupe) };
}

export function claimPluginInteractiveCallbackDedupe(
  dedupeKey: string | undefined,
): boolean {
  if (!dedupeKey) {
    return false;
  }
  return callbackDedupe.has(dedupeKey);
}

export function commitPluginInteractiveCallbackDedupe(
  dedupeKey: string | undefined,
): void {
  if (dedupeKey) {
    callbackDedupe.set(dedupeKey, Date.now());
  }
}

export function releasePluginInteractiveCallbackDedupe(dedupeKey: string | undefined): void {
  if (dedupeKey) {
    callbackDedupe.delete(dedupeKey);
  }
}

export function clearPluginInteractiveHandlersState(): void {
  callbackDedupe.clear();
}

export function clearPluginInteractiveHandlerRegistrationsState(): void {
  callbackDedupe.clear();
}
