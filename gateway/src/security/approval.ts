/**
 * src/security/approval.ts
 *
 * Layer 3: Tool Approval System — CoreBlow 1:1 Pattern
 *
 * Implements allowlist/denylist command approval with three ask modes,
 * following CoreBlow's exact ToolApproval interface.
 *
 * ask modes:
 *   - 'off'     → auto-approve everything (not in denylist)
 *   - 'on-miss' → approve if in allowlist, else ask user
 *   - 'always'  → always ask user before executing
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('security:approval');

// ─── Types (CoreBlow 1:1) ───────────────────────────────────────

export type AskMode = 'off' | 'on-miss' | 'always';

export type ApprovalResult = 'approved' | 'denied' | 'needs-approval';

export interface ApprovalConfig {
    /** Approval behavior mode */
    ask: AskMode;
    /** Glob patterns for allowed commands: ["ls", "cat *", "git *", "npm *"] */
    allowlist: string[];
    /** Absolute deny patterns: ["rm -rf", "sudo *", "curl *"] */
    denylist: string[];
}

export interface ApprovalRequest {
    /** Unique request ID */
    id: string;
    /** The command being requested */
    command: string;
    /** Tool name (e.g., 'exec') */
    tool: string;
    /** Agent that requested this */
    agentId: string;
    /** Source channel */
    source?: string;
    /** Timestamp */
    timestamp: number;
    /** Current status */
    status: 'pending' | 'approved' | 'denied' | 'expired';
}

// ─── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: ApprovalConfig = {
    ask: 'on-miss',
    allowlist: [
        'ls', 'cat *', 'head *', 'tail *', 'wc *',
        'pwd', 'whoami', 'date', 'echo *',
        'git *', 'npm *', 'node *', 'pnpm *',
        'python *', 'python3 *',
    ],
    denylist: [
        'rm -rf /',
        'sudo *',
        'mkfs *',
        'dd if=/dev/zero*',
        'shutdown *',
        'reboot',
        ':(){:|:&};:',
        'kill -9 1',
        'pkill *',
        'killall *',
        'chmod 777 *',
    ],
};

// ─── ToolApproval (CoreBlow 1:1 Pattern) ────────────────────────

/**
 * Tool Approval System — CoreBlow Pattern
 *
 * ```
 * const approval = new ToolApproval({ ask: 'on-miss', allowlist: ['ls', 'git *'], denylist: ['rm -rf'] });
 * approval.check('ls -la')       // → 'approved'
 * approval.check('rm -rf /')     // → 'denied'
 * approval.check('curl example') // → 'needs-approval'
 * ```
 */
export class ToolApproval {
    private readonly config: ApprovalConfig;
    private readonly pendingApprovals = new Map<string, ApprovalRequest>();
    private readonly approvalTimeoutMs: number;

    constructor(config?: Partial<ApprovalConfig>, timeoutMs = 300_000) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.approvalTimeoutMs = timeoutMs;
    }

    /**
     * Check if a command is approved to run.
     * Returns: 'approved' | 'denied' | 'needs-approval'
     *
     * CoreBlow 1:1 interface.
     */
    check(command: string): ApprovalResult {
        const cmd = command.trim();

        // Always deny if in denylist
        if (this.matchesAny(cmd, this.config.denylist)) {
            log.warn({ command: cmd.substring(0, 80) }, 'Command denied by denylist');
            return 'denied';
        }

        switch (this.config.ask) {
            case 'off':
                return 'approved'; // Auto-approve everything not in denylist

            case 'on-miss':
                // Approve if in allowlist, else ask user
                if (this.matchesAny(cmd, this.config.allowlist)) {
                    return 'approved';
                }
                log.info({ command: cmd.substring(0, 80) }, 'Command needs approval (not in allowlist)');
                return 'needs-approval';

            case 'always':
                return 'needs-approval'; // Always ask
        }
    }

    /**
     * Create an approval request and add to pending queue.
     */
    requestApproval(command: string, tool: string, agentId: string, source?: string): ApprovalRequest {
        const request: ApprovalRequest = {
            id: `apr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            command,
            tool,
            agentId,
            source,
            timestamp: Date.now(),
            status: 'pending',
        };

        this.pendingApprovals.set(request.id, request);

        // Auto-expire after timeout
        setTimeout(() => {
            const req = this.pendingApprovals.get(request.id);
            if (req && req.status === 'pending') {
                req.status = 'expired';
                this.pendingApprovals.delete(request.id);
                log.info({ requestId: request.id }, 'Approval request expired');
            }
        }, this.approvalTimeoutMs);

        log.info({ requestId: request.id, tool, command: command.substring(0, 80) }, 'Approval requested');
        return request;
    }

    /**
     * Approve a pending request.
     */
    approve(requestId: string): boolean {
        const request = this.pendingApprovals.get(requestId);
        if (!request || request.status !== 'pending') return false;

        request.status = 'approved';
        this.pendingApprovals.delete(requestId);
        log.info({ requestId }, 'Approval granted');
        return true;
    }

    /**
     * Deny a pending request.
     */
    deny(requestId: string): boolean {
        const request = this.pendingApprovals.get(requestId);
        if (!request || request.status !== 'pending') return false;

        request.status = 'denied';
        this.pendingApprovals.delete(requestId);
        log.info({ requestId }, 'Approval denied');
        return true;
    }

    /**
     * Get all pending approval requests.
     */
    getPending(): ApprovalRequest[] {
        return [...this.pendingApprovals.values()].filter(r => r.status === 'pending');
    }

    /**
     * Get current config.
     */
    getConfig(): Readonly<ApprovalConfig> {
        return this.config;
    }

    // ─── Private ────────────────────────────────────────────────

    /**
     * Glob-style matching (CoreBlow pattern).
     * - "git *" matches "git pull", "git push origin main"
     * - "ls" matches "ls" or "ls -la" (exact prefix + space)
     */
    private matchesAny(cmd: string, patterns: string[]): boolean {
        return patterns.some(pattern => {
            if (pattern.endsWith(' *')) {
                // Wildcard: match prefix
                return cmd.startsWith(pattern.slice(0, -2));
            }
            // Exact match or exact command with args
            return cmd === pattern || cmd.startsWith(pattern + ' ');
        });
    }
}
