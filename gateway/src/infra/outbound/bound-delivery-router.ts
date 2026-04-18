/** CoreBlow — Bound Delivery Router */
export interface DeliveryRoute { channelId: string; targetId: string; priority: number; }
export function resolveDeliveryRoute(routes: DeliveryRoute[], targetId: string): DeliveryRoute | null { const matches = routes.filter((r) => r.targetId === targetId).sort((a, b) => b.priority - a.priority); return matches[0] ?? null; }
