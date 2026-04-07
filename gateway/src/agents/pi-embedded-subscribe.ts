/** PI embedded subscription — event stream handler. */
export type SubscriptionEvent = 'message' | 'tool_use' | 'thinking' | 'error' | 'done';
export interface Subscription { id: string; events: SubscriptionEvent[]; handler: (event: SubscriptionEvent, data: unknown) => void; }
export function createSubscription(events: SubscriptionEvent[], handler: Subscription['handler']): Subscription { return { id: `sub_${Date.now().toString(36)}`, events, handler }; }
