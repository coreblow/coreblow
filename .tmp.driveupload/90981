/**
 * CoreBlow AutoPilot — Directive Types
 *
 * CoreBlow equivalent: auto-reply/reply/directive-handling.params.ts
 */

export type Directive = {
    type: 'model' | 'provider' | 'think' | 'set' | 'reset' | 'context' | 'custom';
    key: string;
    value?: string;
    raw: string;
};

export type DirectiveResult = {
    directives: Directive[];
    cleanedText: string;
    modelOverride?: string;
    providerOverride?: string;
    thinkLevel?: string;
};

export type ThinkLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

export const THINK_LEVEL_ORDER: Record<string, number> = { off: 0, low: 1, medium: 2, high: 3, xhigh: 4 };
