/** CoreBlow — Current Conversation Bindings */
const bindings = new Map<string, string>();
export function bindConversation(sessionId: string, conversationId: string): void { bindings.set(sessionId, conversationId); }
export function getConversationBinding(sessionId: string): string | undefined { return bindings.get(sessionId); }
export function clearConversationBindings(): void { bindings.clear(); }
