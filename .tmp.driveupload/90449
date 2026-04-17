/**
 * mcp/channel-bridge.ts
 * Bridge between MCP protocol and CoreBlow gateway.
 * Follows CoreBlow's channel-bridge.ts pattern using GatewayClient.
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';
import type {
    ApprovalDecision, ChatHistoryResult, ClaudeChannelMode, ClaudePermissionRequest,
    ConversationDescriptor, PendingApproval, QueueEvent, SessionListResult,
    SessionMessagePayload, WaitFilter,
} from './channel-types.js';
import { matchEventFilter, toConversation, toText } from './channel-types.js';

const log = createChildLogger('mcp:channel-bridge');

type PendingWaiter = {
    filter: WaitFilter;
    resolve: (value: QueueEvent | null) => void;
    timeout: NodeJS.Timeout | null;
};

export type ChannelBridgeOptions = {
    gatewayUrl?: string;
    gatewayToken?: string;
    gatewayPassword?: string;
    claudeChannelMode?: ClaudeChannelMode;
    verbose?: boolean;
};

export class CoreBlowChannelBridge {
    private waiters: PendingWaiter[] = [];
    private eventCursor = 0;
    private eventBuffer: QueueEvent[] = [];
    private pendingApprovals = new Map<string, PendingApproval>();
    private server: unknown = null;
    private started = false;

    constructor(
        private readonly config: Record<string, unknown>,
        private readonly opts: ChannelBridgeOptions = {},
    ) {}

    setServer(server: unknown): void { this.server = server; }

    async start(): Promise<void> {
        if (this.started) return;
        this.started = true;
        log.info({ gatewayUrl: this.opts.gatewayUrl }, 'Channel bridge started');
    }

    async close(): Promise<void> {
        this.started = false;
        for (const waiter of this.waiters) {
            if (waiter.timeout) clearTimeout(waiter.timeout);
            waiter.resolve(null);
        }
        this.waiters = [];
        log.info('Channel bridge closed');
    }

    // ─── Conversations ──────────────────────────────────────────

    async listConversations(params?: {
        limit?: number; search?: string; channel?: string;
    }): Promise<ConversationDescriptor[]> {
        const sessions = await this.fetchSessions();
        let conversations = (sessions.sessions ?? [])
            .map((s: unknown) => toConversation(s as import("./channel-types.js").SessionRow))
            .filter((c): c is ConversationDescriptor => c !== null);

        if (params?.channel) {
            conversations = conversations.filter(c => c.channel === params.channel);
        }
        if (params?.search) {
            const q = params.search.toLowerCase();
            conversations = conversations.filter(c =>
                c.displayName?.toLowerCase().includes(q) ||
                c.derivedTitle?.toLowerCase().includes(q) ||
                c.lastMessagePreview?.toLowerCase().includes(q) ||
                c.sessionKey.toLowerCase().includes(q),
            );
        }

        return conversations.slice(0, params?.limit ?? 50);
    }

    async getConversationHistory(sessionKey: string, limit?: number): Promise<ChatHistoryResult> {
        // Gateway integration point — would call gateway API
        log.debug({ sessionKey, limit }, 'Fetching conversation history');
        return { messages: [] };
    }

    async sendMessage(sessionKey: string, text: string): Promise<{ success: boolean; messageId?: string }> {
        const messageId = `msg_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
        log.info({ sessionKey, messageId, textLen: text.length }, 'Message sent via MCP bridge');

        this.pushEvent({
            cursor: ++this.eventCursor, type: 'message', sessionKey,
            messageId, role: 'user', text,
            raw: { sessionKey, messageId, message: { role: 'user', content: text } },
        });

        return { success: true, messageId };
    }

    // ─── Event Queue ────────────────────────────────────────────

    async waitForEvent(filter: WaitFilter, timeoutMs = 30000): Promise<QueueEvent | null> {
        // Check buffer first
        const buffered = this.eventBuffer.find(e => matchEventFilter(e, filter));
        if (buffered) return buffered;

        return new Promise<QueueEvent | null>((resolve) => {
            const timeout = setTimeout(() => {
                this.waiters = this.waiters.filter(w => w.resolve !== resolve);
                resolve(null);
            }, timeoutMs);
            this.waiters.push({ filter, resolve, timeout });
        });
    }

    private pushEvent(event: QueueEvent): void {
        this.eventBuffer.push(event);
        if (this.eventBuffer.length > 1000) this.eventBuffer = this.eventBuffer.slice(-500);

        const matched: PendingWaiter[] = [];
        for (const waiter of this.waiters) {
            if (matchEventFilter(event, waiter.filter)) {
                if (waiter.timeout) clearTimeout(waiter.timeout);
                waiter.resolve(event);
                matched.push(waiter);
            }
        }
        this.waiters = this.waiters.filter(w => !matched.includes(w));
    }

    // ─── Approvals ──────────────────────────────────────────────

    async listPendingApprovals(): Promise<PendingApproval[]> {
        return Array.from(this.pendingApprovals.values());
    }

    async handleApproval(id: string, decision: ApprovalDecision): Promise<boolean> {
        const approval = this.pendingApprovals.get(id);
        if (!approval) return false;
        this.pendingApprovals.delete(id);
        log.info({ id, decision, kind: approval.kind }, 'Approval handled');

        this.pushEvent({
            cursor: ++this.eventCursor,
            type: `${approval.kind}_approval_resolved`,
            raw: { id, decision },
        });

        return true;
    }

    async handleClaudePermissionRequest(req: ClaudePermissionRequest): Promise<void> {
        const approval: PendingApproval = {
            kind: 'exec', id: req.requestId,
            request: { toolName: req.toolName, description: req.description, inputPreview: req.inputPreview },
            createdAtMs: Date.now(), expiresAtMs: Date.now() + 300_000,
        };
        this.pendingApprovals.set(req.requestId, approval);

        this.pushEvent({
            cursor: ++this.eventCursor, type: 'claude_permission_request',
            requestId: req.requestId, toolName: req.toolName,
            description: req.description, inputPreview: req.inputPreview,
        });
    }

    // ─── Internal ───────────────────────────────────────────────

    private async fetchSessions(): Promise<SessionListResult> {
        // Gateway integration — would call gateway /sessions endpoint
        return { sessions: [] };
    }
}
