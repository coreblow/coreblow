/** CoreBlow — Protocol Frames */ export interface Frame { type: "request" | "response" | "event" | "error"; id: string; payload: unknown; }
