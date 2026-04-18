/**
 * plugin-sdk/approval-runtime.ts
 * Tool approval flow for plugins.
 * Ported from CoreBlow src/plugin-sdk/approval-runtime.ts.
 */

export type ApprovalDecision = 'approved' | 'denied' | 'timeout';

export interface ApprovalRequest {
    toolName: string;
    args: Record<string, unknown>;
    description: string;
    requestedBy: string;
    timestamp: number;
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<ApprovalDecision>;

/**
 * Create an approval runtime for tool execution.
 */
export function createApprovalRuntime(opts?: { defaultTimeoutMs?: number }) {
    const handlers: ApprovalHandler[] = [];
    const defaultTimeoutMs = opts?.defaultTimeoutMs ?? 30_000;

    function registerHandler(handler: ApprovalHandler): () => void {
        handlers.push(handler);
        return () => { const idx = handlers.indexOf(handler); if (idx >= 0) handlers.splice(idx, 1); };
    }

    async function requestApproval(request: Omit<ApprovalRequest, 'timestamp'>): Promise<ApprovalDecision> {
        const fullRequest: ApprovalRequest = { ...request, timestamp: Date.now() };

        if (handlers.length === 0) return 'approved';

        for (const handler of handlers) {
            const result = await Promise.race([
                handler(fullRequest),
                new Promise<ApprovalDecision>((resolve) => setTimeout(() => resolve('timeout'), defaultTimeoutMs)),
            ]);
            if (result === 'denied') return 'denied';
            if (result === 'timeout') return 'timeout';
        }
        return 'approved';
    }

    function getApprovalPolicy(toolName: string, cfg?: Record<string, unknown>): 'off' | 'on-miss' | 'always' {
        const agents = cfg?.agents as Record<string, unknown> | undefined;
        const defaults = agents?.defaults as Record<string, unknown> | undefined;
        const approval = defaults?.approval as Record<string, unknown> | undefined;
        const mode = approval?.mode as string | undefined;
        if (mode === 'always') return 'always';
        if (mode === 'on-miss' || mode === 'ask') return 'on-miss';
        return 'off';
    }

    return { registerHandler, requestApproval, getApprovalPolicy };
}
