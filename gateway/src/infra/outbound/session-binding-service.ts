/** CoreBlow — Session Binding Service */
const bindings = new Map<string, string>();
export function bindSession(key: string, sessionId: string): void { bindings.set(key, sessionId); }
export function getSessionBinding(key: string): string | undefined { return bindings.get(key); }
export function removeSessionBinding(key: string): void { bindings.delete(key); }
export function clearSessionBindings(): void { bindings.clear(); }
