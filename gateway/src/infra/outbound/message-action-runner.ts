/** CoreBlow — Message Action Runner */
export type ActionHandler = (actionId: string, data: Record<string, unknown>) => Promise<unknown>;
const handlers = new Map<string, ActionHandler>();
export function registerActionHandler(type: string, handler: ActionHandler): void { handlers.set(type, handler); }
export async function runAction(type: string, actionId: string, data: Record<string, unknown>): Promise<unknown> { const handler = handlers.get(type); if (!handler) throw new Error("No handler for action type: " + type); return handler(actionId, data); }
