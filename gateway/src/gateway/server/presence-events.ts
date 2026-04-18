/** CoreBlow — Presence Events */ export type PresenceStatus = "online" | "away" | "offline"; export interface PresenceEvent { userId: string; status: PresenceStatus; timestamp: number; }
