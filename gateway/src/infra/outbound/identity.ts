/** CoreBlow — Outbound Identity */
export interface OutboundIdentity { botId: string; botName: string; avatarUrl?: string; }
let identity: OutboundIdentity = { botId: "coreblow", botName: "CoreBlow" };
export function setOutboundIdentity(id: OutboundIdentity): void { identity = id; }
export function getOutboundIdentity(): OutboundIdentity { return identity; }
