export interface AppMessage { type: string; payload: any; timestamp: number; }
export function createMessage(type: string, payload: any): AppMessage { return { type, payload, timestamp: Date.now() }; }
