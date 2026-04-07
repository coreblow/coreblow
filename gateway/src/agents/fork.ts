/**
 * src/agents/fork.ts
 * Conversation branching — fork, explore, merge, compare
 * SUPERIOR: CoreBlow = linear only; CoreBlow = branching + parallel exploration
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';
import type { ChatMessage } from '../providers/interface.js';

const log = createChildLogger('fork');

// ─── Types ────────────────────────────────────────────────────────

export interface Branch {
    id: string;
    name: string;
    parentId: string | null; // null = root
    messages: ChatMessage[];
    createdAt: number;
    /** Summary of what this branch explored */
    summary?: string;
    /** Whether this branch is active */
    active: boolean;
    /** Branch metadata */
    metadata?: Record<string, unknown>;
}

export interface ForkResult {
    branchId: string;
    name: string;
    parentId: string;
}

export interface MergeResult {
    mergedInto: string;
    mergedFrom: string;
    addedMessages: number;
}

export interface BranchComparison {
    branchA: { id: string; name: string; messageCount: number; lastMessage?: string };
    branchB: { id: string; name: string; messageCount: number; lastMessage?: string };
    commonAncestorMessages: number;
    divergedAt: number;
}

// ─── Fork Manager ────────────────────────────────────────────────

export class ForkManager {
    private branches = new Map<string, Branch>();
    private sessionBranches = new Map<string, Set<string>>(); // sessionId → branchIds
    private activeBranch = new Map<string, string>(); // sessionId → active branchId

    /**
     * Initialize root branch for a session
     */
    initSession(sessionId: string, messages: ChatMessage[] = []): string {
        const rootId = `${sessionId}_root`;

        if (this.branches.has(rootId)) return rootId;

        const root: Branch = {
            id: rootId,
            name: 'main',
            parentId: null,
            messages: [...messages],
            createdAt: Date.now(),
            active: true,
        };

        this.branches.set(rootId, root);
        this.sessionBranches.set(sessionId, new Set([rootId]));
        this.activeBranch.set(sessionId, rootId);

        return rootId;
    }

    /**
     * Fork a conversation into a new branch
     * The new branch starts with a copy of the parent's messages
     */
    fork(sessionId: string, name: string, fromBranchId?: string): ForkResult {
        const parentId = fromBranchId || this.activeBranch.get(sessionId);
        if (!parentId) throw new Error(`No active branch for session ${sessionId}`);

        const parent = this.branches.get(parentId);
        if (!parent) throw new Error(`Branch not found: ${parentId}`);

        const branchId = `${sessionId}_${randomUUID().slice(0, 8)}`;
        const branch: Branch = {
            id: branchId,
            name,
            parentId,
            messages: [...parent.messages], // copy parent messages
            createdAt: Date.now(),
            active: true,
        };

        this.branches.set(branchId, branch);

        const sessionSet = this.sessionBranches.get(sessionId) || new Set();
        sessionSet.add(branchId);
        this.sessionBranches.set(sessionId, sessionSet);

        log.info({ sessionId, branchId, name, parentId }, 'Conversation forked');

        return { branchId, name, parentId };
    }

    /**
     * Switch active branch for a session
     */
    switchBranch(sessionId: string, branchId: string): boolean {
        const branch = this.branches.get(branchId);
        if (!branch) return false;

        this.activeBranch.set(sessionId, branchId);
        log.info({ sessionId, branchId, name: branch.name }, 'Switched to branch');
        return true;
    }

    /**
     * Get the active branch for a session
     */
    getActiveBranch(sessionId: string): Branch | undefined {
        const branchId = this.activeBranch.get(sessionId);
        return branchId ? this.branches.get(branchId) : undefined;
    }

    /**
     * Get messages for a branch
     */
    getMessages(branchId: string): ChatMessage[] {
        return this.branches.get(branchId)?.messages || [];
    }

    /**
     * Append a message to a branch
     */
    appendMessage(branchId: string, message: ChatMessage): void {
        const branch = this.branches.get(branchId);
        if (branch) {
            branch.messages.push(message);
        }
    }

    /**
     * Append message to the active branch of a session
     */
    appendToActive(sessionId: string, message: ChatMessage): void {
        const branchId = this.activeBranch.get(sessionId);
        if (branchId) this.appendMessage(branchId, message);
    }

    /**
     * Merge a branch into another
     * Only merges messages that diverged from the common ancestor
     */
    merge(sessionId: string, fromBranchId: string, intoBranchId?: string): MergeResult {
        const targetId = intoBranchId || this.activeBranch.get(sessionId);
        if (!targetId) throw new Error('No target branch');

        const from = this.branches.get(fromBranchId);
        const into = this.branches.get(targetId);
        if (!from || !into) throw new Error('Branch not found');

        // Find divergence point
        let commonLength = 0;
        const minLen = Math.min(from.messages.length, into.messages.length);
        for (let i = 0; i < minLen; i++) {
            if (from.messages[i].content === into.messages[i].content &&
                from.messages[i].role === into.messages[i].role) {
                commonLength = i + 1;
            } else {
                break;
            }
        }

        // Add divergent messages from source with a marker
        const divergent = from.messages.slice(commonLength);
        if (divergent.length > 0) {
            into.messages.push({
                role: 'system',
                content: `[Merged from branch "${from.name}": ${divergent.length} messages]`,
            });
            into.messages.push(...divergent);
        }

        from.active = false;

        log.info({ from: fromBranchId, into: targetId, added: divergent.length }, 'Branch merged');

        return {
            mergedInto: targetId,
            mergedFrom: fromBranchId,
            addedMessages: divergent.length,
        };
    }

    /**
     * Compare two branches
     */
    compare(branchIdA: string, branchIdB: string): BranchComparison {
        const a = this.branches.get(branchIdA);
        const b = this.branches.get(branchIdB);
        if (!a || !b) throw new Error('Branch not found');

        let commonLength = 0;
        const minLen = Math.min(a.messages.length, b.messages.length);
        for (let i = 0; i < minLen; i++) {
            if (a.messages[i].content === b.messages[i].content &&
                a.messages[i].role === b.messages[i].role) {
                commonLength = i + 1;
            } else break;
        }

        const lastA = a.messages[a.messages.length - 1];
        const lastB = b.messages[b.messages.length - 1];

        return {
            branchA: {
                id: a.id,
                name: a.name,
                messageCount: a.messages.length,
                lastMessage: lastA?.content?.slice(0, 100),
            },
            branchB: {
                id: b.id,
                name: b.name,
                messageCount: b.messages.length,
                lastMessage: lastB?.content?.slice(0, 100),
            },
            commonAncestorMessages: commonLength,
            divergedAt: commonLength,
        };
    }

    /**
     * List all branches for a session
     */
    listBranches(sessionId: string): Branch[] {
        const branchIds = this.sessionBranches.get(sessionId) || new Set();
        return [...branchIds]
            .map(id => this.branches.get(id))
            .filter((b): b is Branch => !!b);
    }

    /**
     * Delete a branch
     */
    deleteBranch(branchId: string): boolean {
        const branch = this.branches.get(branchId);
        if (!branch || !branch.parentId) return false; // can't delete root

        // Find session
        for (const [sessionId, branchIds] of this.sessionBranches) {
            if (branchIds.has(branchId)) {
                branchIds.delete(branchId);
                if (this.activeBranch.get(sessionId) === branchId) {
                    // Switch to parent
                    this.activeBranch.set(sessionId, branch.parentId);
                }
                break;
            }
        }

        return this.branches.delete(branchId);
    }

    /**
     * Get branch tree (for visualization)
     */
    getTree(sessionId: string): { id: string; name: string; parent: string | null; active: boolean; messageCount: number }[] {
        return this.listBranches(sessionId).map(b => ({
            id: b.id,
            name: b.name,
            parent: b.parentId,
            active: this.activeBranch.get(sessionId) === b.id,
            messageCount: b.messages.length,
        }));
    }

    /**
     * Get stats
     */
    getStats(): { totalBranches: number; totalSessions: number; activeBranches: number } {
        return {
            totalBranches: this.branches.size,
            totalSessions: this.sessionBranches.size,
            activeBranches: [...this.branches.values()].filter(b => b.active).length,
        };
    }
}
