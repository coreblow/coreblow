/** CoreBlow — Deliver Runtime */
export interface DeliveryRuntime { send: (channelId: string, payload: unknown) => Promise<boolean>; isReady: () => boolean; }
let runtime: DeliveryRuntime | null = null;
export function setDeliveryRuntime(r: DeliveryRuntime): void { runtime = r; }
export function getDeliveryRuntime(): DeliveryRuntime | null { return runtime; }
