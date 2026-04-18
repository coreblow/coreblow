/** CoreBlow — Outbound Targets */
export interface OutboundTarget { id: string; channelId: string; name: string; type: string; enabled: boolean; }
export function filterEnabledTargets(targets: OutboundTarget[]): OutboundTarget[] { return targets.filter((t) => t.enabled); }
