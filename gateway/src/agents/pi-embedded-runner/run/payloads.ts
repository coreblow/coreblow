/** CoreBlow — PI Run Payloads */ export interface RunPayload { messages: Array<{ role: string; content: string }>; tools?: unknown[]; }
