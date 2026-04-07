/**
 * agents/path-policy.ts
 * Path-based access policy for file operations.
 */
import path from 'node:path';
export type PathAction = 'read' | 'write' | 'delete' | 'list';
export interface PathPolicyRule { pattern: string; actions: PathAction[]; allow: boolean; }

export class PathPolicy {
    private rules: PathPolicyRule[] = [];
    constructor(rules?: PathPolicyRule[]) { if (rules) this.rules = rules; }
    addRule(rule: PathPolicyRule): void { this.rules.push(rule); }
    check(filePath: string, action: PathAction): { allowed: boolean; reason?: string } {
        const resolved = path.resolve(filePath);
        for (const rule of this.rules) {
            if (resolved.includes(rule.pattern) && rule.actions.includes(action)) {
                return rule.allow ? { allowed: true } : { allowed: false, reason: `Blocked by rule: ${rule.pattern}` };
            }
        }
        return { allowed: true }; // default allow
    }
}
