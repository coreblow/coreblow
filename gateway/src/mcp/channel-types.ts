export interface SessionRow { id: string; channel: string; model: string; createdAt: number; }
export interface QueueEvent { cursor?: number; type: string; channel?: string; sessionKey?: string; messageId?: string; content?: string; role?: string; pending?: PendingApproval; timestamp?: number; data?: unknown; raw?: unknown; requestId?: string; toolName?: string; description?: string; inputPreview?: string; text?: string;}
export interface WaitFilter { type?: string; channel?: string; sessionKey?: string; types?: string[]; }
export interface ConversationDescriptor { id?: string; sessionKey: string; channel: string; startedAt?: number; lastActivity: number; displayName?: string; derivedTitle?: string; lastMessagePreview?: string; }
export interface PendingApproval { id: string; tool?: string; args?: unknown; kind?: string; request?: Record<string, unknown>; createdAtMs?: number; expiresAtMs?: number; }
export interface SessionListResult { conversations?: ConversationDescriptor[]; total?: number; sessions?: unknown[]; }
export interface ClaudeChannelMode { enabled?: boolean; }
export interface ClaudePermissionRequest { requestId: string; toolName: string; description?: string; inputPreview?: string; }
export interface ApprovalDecision { approved: boolean; [key: string]: unknown; }
export interface ChatHistoryResult { messages: unknown[]; }
export interface SessionMessagePayload { sessionKey: string; content: string; role?: string; }
export function toText(value: unknown): string | undefined { return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined; }
export function resolveMessageId(entry: Record<string, unknown>): string | undefined { return toText(entry.id) ?? (entry.__coreblow && typeof entry.__coreblow === "object" ? toText((entry.__coreblow as { id?: unknown }).id) : undefined); }
export function summarizeResult(label: string, count: number): { content: Array<{ type: "text"; text: string }> } { return { content: [{ type: "text", text: `${label}: ${count}` }] }; }
export function extractAttachmentsFromMessage(message: unknown): unknown[] { if (!message || typeof message !== "object") return []; return (message as Record<string, unknown>).attachments as unknown[] || []; }
export function toConversation(row: SessionRow): ConversationDescriptor | null { if (!row) return null; return { sessionKey: row.id, channel: row.channel, startedAt: row.createdAt, lastActivity: row.createdAt }; }
export function matchEventFilter(event: QueueEvent, filter: WaitFilter): boolean { if (filter.type && event.type !== filter.type) return false; if (filter.channel && event.channel !== filter.channel) return false; return true; }
export function normalizeApprovalId(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
