/** CoreBlow — PI Runner Types */ export interface PiConfig { model: string; provider: string; maxTurns: number; timeout: number; } export type PiStatus = "idle" | "running" | "error" | "complete";
