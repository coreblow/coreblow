/**
 * sessions/session-manager.ts
 */
export class SessionManager { private sessions = new Map<string, {model: string; messages: unknown[]; createdAt: number}>(); create(id: string, model: string) { this.sessions.set(id, {model, messages: [], createdAt: Date.now()}); return id; } get(id: string) { return this.sessions.get(id); } addMessage(id: string, msg: unknown) { this.sessions.get(id)?.messages.push(msg); } delete(id: string) { this.sessions.delete(id); } list() { return [...this.sessions.keys()]; } count() { return this.sessions.size; } }
