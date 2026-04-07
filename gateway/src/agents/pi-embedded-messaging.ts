/** PI embedded message types. */
export interface PiMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | unknown[]; timestamp: number; }
export function createMessage(role: PiMessage['role'], content: string): PiMessage { return { role, content, timestamp: Date.now() }; }
