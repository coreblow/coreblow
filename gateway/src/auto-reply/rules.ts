/**
 * auto-reply/rules.ts
 * Rule-based reply matching engine.
 */

export type RuleConditionType = 'regex' | 'keyword' | 'startsWith' | 'exact' | 'contains';

export interface ReplyRule {
    id: string;
    name: string;
    priority: number;
    enabled: boolean;
    condition: {
        type: RuleConditionType;
        pattern: string;
        flags?: string;
        channel?: string;
        sender?: string;
    };
    response: {
        template: string;
        model?: string;
        skipAI?: boolean;
    };
}

/**
 * Evaluate if a message matches a rule condition.
 */
export function matchesRule(rule: ReplyRule, message: string, context?: { channel?: string; sender?: string }): boolean {
    if (!rule.enabled) return false;

    // Check channel/sender constraints
    if (rule.condition.channel && context?.channel !== rule.condition.channel) return false;
    if (rule.condition.sender && context?.sender !== rule.condition.sender) return false;

    const text = message.trim();
    switch (rule.condition.type) {
        case 'exact':
            return text.toLowerCase() === rule.condition.pattern.toLowerCase();
        case 'startsWith':
            return text.toLowerCase().startsWith(rule.condition.pattern.toLowerCase());
        case 'contains':
            return text.toLowerCase().includes(rule.condition.pattern.toLowerCase());
        case 'keyword': {
            const keywords = rule.condition.pattern.split(/[,|]/).map((k) => k.trim().toLowerCase());
            const words = text.toLowerCase().split(/\s+/);
            return keywords.some((kw) => words.includes(kw));
        }
        case 'regex': {
            try {
                const re = new RegExp(rule.condition.pattern, rule.condition.flags ?? 'i');
                return re.test(text);
            } catch { return false; }
        }
        default:
            return false;
    }
}

/**
 * Find the first matching rule, sorted by priority (highest first).
 */
export function findMatchingRule(rules: ReplyRule[], message: string, context?: { channel?: string; sender?: string }): ReplyRule | undefined {
    const sorted = [...rules].sort((a, b) => b.priority - a.priority);
    return sorted.find((rule) => matchesRule(rule, message, context));
}

/**
 * Resolve reply rules from config.
 */
export function resolveReplyRules(cfg: Record<string, unknown>): ReplyRule[] {
    const agents = cfg.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    const rules = defaults?.replyRules;
    if (!Array.isArray(rules)) return [];
    return rules.filter((r): r is ReplyRule => typeof r === 'object' && r !== null && 'id' in r && 'condition' in r);
}

/**
 * Expand a response template with context variables.
 */
export function expandTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
