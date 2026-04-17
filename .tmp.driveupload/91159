/**
 * agents/tool-policy.ts
 * Tool execution policy — approval, blocking, auto-run rules.
 */
export type PolicyDecision = 'allow' | 'deny' | 'require_approval' | 'warn';
export interface ToolPolicyRule { toolPattern: string; decision: PolicyDecision; reason?: string; priority?: number; }
export interface ToolPolicyResult { decision: PolicyDecision; matchedRule?: ToolPolicyRule; reason?: string; }

export class ToolPolicy {
    private rules: ToolPolicyRule[] = [];
    private defaultDecision: PolicyDecision = 'allow';

    constructor(rules?: ToolPolicyRule[], defaultDecision?: PolicyDecision) {
        if (rules) this.rules = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        if (defaultDecision) this.defaultDecision = defaultDecision;
    }

    addRule(rule: ToolPolicyRule): void {
        this.rules.push(rule);
        this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    evaluate(toolName: string, args?: Record<string, unknown>): ToolPolicyResult {
        for (const rule of this.rules) {
            if (this.matchesPattern(toolName, rule.toolPattern)) {
                return { decision: rule.decision, matchedRule: rule, reason: rule.reason };
            }
        }
        return { decision: this.defaultDecision };
    }

    private matchesPattern(name: string, pattern: string): boolean {
        if (pattern === '*') return true;
        if (pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1));
        if (pattern.startsWith('*')) return name.endsWith(pattern.slice(1));
        return name === pattern;
    }

    listRules(): readonly ToolPolicyRule[] { return this.rules; }
    clearRules(): void { this.rules = []; }
}

export const DANGEROUS_TOOLS = new Set(['rm', 'rmdir', 'format', 'mkfs', 'dd', 'fdisk']);
export function isDangerousTool(name: string): boolean { return DANGEROUS_TOOLS.has(name.toLowerCase()); }
