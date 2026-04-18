/**
 * src/auto-reply/reply/session-fork.ts
 * Session isolation and forking for the auto-reply pipeline.
 * Follows CoreBlow session isolation pattern:
 * - DM = shared main session
 * - Group = isolated per group
 *
 * Bridges auto-reply context with agents/fork.ts ForkManager.
 */

import { ForkManager } from '../../agents/fork.js';
import type { ChatMessage } from '../../providers/interface.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('session-fork');

export interface SessionForkOptions {
    /** Whether this is a direct message or a group chat */
    chatType: 'dm' | 'group';
    /** Unique ID of the chat/group */
    chatId: string;
    /** The agent handling this session */
    agentId: string;
}

export class SessionFork {
    private forkManager: ForkManager;

    constructor(forkManager?: ForkManager) {
        this.forkManager = forkManager || new ForkManager();
    }

    /**
     * Resolve the base session ID based on chat type (DM vs Group pattern)
     */
    resolveBaseSessionId(opts: SessionForkOptions): string {
        if (opts.chatType === 'dm') {
            // DM: Shared main session for the user across the agent
            return `dm_${opts.chatId}_${opts.agentId}`;
        } else {
            // Group: Isolated per group + agent
            return `group_${opts.chatId}_${opts.agentId}`;
        }
    }

    /**
     * Initialize or resume a session branch
     */
    initOrResume(opts: SessionForkOptions, initialMessages: ChatMessage[] = []): string {
        const baseSessionId = this.resolveBaseSessionId(opts);
        return this.forkManager.initSession(baseSessionId, initialMessages);
    }

    /**
     * Fork the current session into a new exploration branch
     */
    fork(opts: SessionForkOptions, branchName: string): string {
        const baseSessionId = this.resolveBaseSessionId(opts);
        const result = this.forkManager.fork(baseSessionId, branchName);
        return result.branchId;
    }

    /**
     * Switch back to the main branch or another branch
     */
    switchBranch(opts: SessionForkOptions, branchId: string): boolean {
        const baseSessionId = this.resolveBaseSessionId(opts);
        return this.forkManager.switchBranch(baseSessionId, branchId);
    }

    /**
     * Merge an exploration branch back into the active branch
     */
    mergeBranch(opts: SessionForkOptions, branchId: string): number {
        const baseSessionId = this.resolveBaseSessionId(opts);
        const result = this.forkManager.merge(baseSessionId, branchId);
        return result.addedMessages;
    }

    /**
     * Access the underlying ForkManager
     */
    getManager(): ForkManager {
        return this.forkManager;
    }
}
