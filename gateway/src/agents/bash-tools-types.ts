/**
 * agents/bash-tools-types.ts
 * Bash/exec tool type definitions.
 * Ported from CoreBlow src/agents/bash-tools.exec-types.ts.
 */

export type ExecApprovalPolicy = 'auto' | 'manual' | 'allowlist' | 'sandbox';

export interface ExecRequest {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    stdin?: string;
    shell?: boolean;
    elevated?: boolean;
}

export interface ExecResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    killed: boolean;
    timedOut: boolean;
    durationMs: number;
    signal?: string;
}

export interface ExecApprovalRequest {
    requestId: string;
    sessionId: string;
    command: string;
    args: string[];
    cwd: string;
    reason?: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    timestamp: number;
}

export interface ExecApprovalResponse {
    requestId: string;
    approved: boolean;
    respondedBy?: string;
    respondedAt: number;
    reason?: string;
}

/**
 * Command risk classifier.
 */
export function classifyCommandRisk(command: string): ExecApprovalRequest['risk'] {
    const cmd = command.toLowerCase().trim();
    const critical = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'chmod 777 /', 'shutdown', 'reboot', 'halt', 'init 0'];
    if (critical.some((c) => cmd.includes(c))) return 'critical';
    const high = ['rm -rf', 'sudo', 'chmod', 'chown', 'kill -9', 'pkill', 'curl.*|.*sh', 'wget.*|.*sh', 'npm publish', 'docker rm', 'git push --force'];
    if (high.some((c) => cmd.includes(c))) return 'high';
    const medium = ['npm install', 'pip install', 'git push', 'docker', 'systemctl', 'sed -i', 'mv ', 'cp -r'];
    if (medium.some((c) => cmd.includes(c))) return 'medium';
    return 'low';
}

/**
 * Check if command should auto-approve based on policy.
 */
export function shouldAutoApprove(command: string, policy: ExecApprovalPolicy, allowlist?: string[]): boolean {
    if (policy === 'auto') return true;
    if (policy === 'manual') return false;
    if (policy === 'sandbox') return true; // sandbox handles isolation
    if (policy === 'allowlist' && allowlist) {
        const cmd = command.split(/\s+/)[0];
        return allowlist.includes(cmd);
    }
    return false;
}

/**
 * Safe command patterns that never need approval.
 */
const SAFE_COMMANDS = ['echo', 'cat', 'ls', 'pwd', 'whoami', 'date', 'uname', 'env', 'which', 'head', 'tail', 'wc', 'sort', 'uniq', 'grep', 'find', 'tree'];

export function isSafeCommand(command: string): boolean {
    const cmd = command.trim().split(/\s+/)[0];
    return SAFE_COMMANDS.includes(cmd);
}
