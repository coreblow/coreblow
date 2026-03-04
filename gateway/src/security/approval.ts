/**
 * src/security/approval.ts
 * Tool approval system — ask modes and allowlist/denylist
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('approval');

export type AskMode = 'off' | 'on-miss' | 'always';

export interface ApprovalConfig {
    askMode: AskMode;
    allowlist: string[];
    denylist: string[];
}

const DEFAULT_CONFIG: ApprovalConfig = {
    askMode: 'off',
    allowlist: [],
    denylist: [],
};

let config: ApprovalConfig = { ...DEFAULT_CONFIG };
const pendingApprovals: Map<string, (approved: boolean) => void> = new Map();

export function setApprovalConfig(cfg: Partial<ApprovalConfig>) {
    config = { ...DEFAULT_CONFIG, ...cfg };
    log.info({ askMode: config.askMode }, 'Approval config updated');
}

/**
 * Check if a tool call should be allowed
 */
export function checkApproval(toolName: string, command?: string): 'allowed' | 'denied' | 'needs-approval' {
    // Denylist always blocks
    if (config.denylist.includes(toolName)) {
        log.warn({ tool: toolName }, 'Tool denied by denylist');
        return 'denied';
    }

    // Ask mode: off = allow everything
    if (config.askMode === 'off') {
        return 'allowed';
    }

    // Allowlist check
    if (config.allowlist.includes(toolName)) {
        return 'allowed';
    }

    // For exec tool, check command allowlist
    if (toolName === 'exec' && command) {
        const cmdBase = command.split(' ')[0];
        if (config.allowlist.includes(`exec:${cmdBase}`)) {
            return 'allowed';
        }
    }

    // Ask mode: on-miss = ask if not in allowlist
    if (config.askMode === 'on-miss') {
        return 'needs-approval';
    }

    // Ask mode: always
    if (config.askMode === 'always') {
        return 'needs-approval';
    }

    return 'allowed';
}

/**
 * Request approval from user (via channel)
 */
export function requestApproval(toolName: string, args: Record<string, any>): Promise<boolean> {
    const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    log.info({ id, tool: toolName }, 'Requesting tool approval');

    return new Promise((resolve) => {
        pendingApprovals.set(id, resolve);

        // Auto-timeout after 60s (deny)
        setTimeout(() => {
            if (pendingApprovals.has(id)) {
                pendingApprovals.delete(id);
                log.warn({ id, tool: toolName }, 'Approval timed out, denying');
                resolve(false);
            }
        }, 60_000);
    });
}

/**
 * Respond to a pending approval
 */
export function respondApproval(id: string, approved: boolean) {
    const resolver = pendingApprovals.get(id);
    if (resolver) {
        pendingApprovals.delete(id);
        resolver(approved);
        log.info({ id, approved }, 'Approval response');
    }
}
