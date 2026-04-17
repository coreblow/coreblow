/**
 * auto-reply/reply/directive-handler.ts
 * Apply parsed directives to the reply context.
 * Follows CoreBlow's directive-handling.impl.ts pattern.
 */

import { createChildLogger } from '../../utils/logger.js';
import type { ParsedDirective } from './directive-parser.js';

const log = createChildLogger('reply:directive-handler');

export interface ReplyContext {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    style: string;
    persona: string;
    compact: boolean;
    shouldReset: boolean;
}

const DEFAULT_CONTEXT: ReplyContext = {
    model: 'default',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '',
    style: 'default',
    persona: 'default',
    compact: false,
    shouldReset: false,
};

/** Apply directives to a reply context, returning modified context. */
export function applyDirectives(
    directives: ParsedDirective[],
    current: Partial<ReplyContext> = {},
): ReplyContext {
    const ctx: ReplyContext = { ...DEFAULT_CONTEXT, ...current };

    for (const directive of directives) {
        switch (directive.type) {
            case 'model':
                ctx.model = directive.value;
                log.debug({ model: directive.value }, 'Model switched via directive');
                break;

            case 'temperature': {
                const temp = parseFloat(directive.value);
                if (!isNaN(temp) && temp >= 0 && temp <= 2) {
                    ctx.temperature = temp;
                }
                break;
            }

            case 'max_tokens': {
                const tokens = parseInt(directive.value);
                if (!isNaN(tokens) && tokens > 0 && tokens <= 128000) {
                    ctx.maxTokens = tokens;
                }
                break;
            }

            case 'style':
                ctx.style = directive.value;
                break;

            case 'persona':
                ctx.persona = directive.value;
                break;

            case 'compact':
                ctx.compact = directive.value === 'on';
                break;

            case 'system':
                ctx.systemPrompt = directive.value;
                break;

            case 'reset':
                ctx.shouldReset = true;
                break;
        }
    }

    return ctx;
}

/** Validate that a user has permission to use specific directives. */
export function validateDirectivePermissions(
    directives: ParsedDirective[],
    userLevel: 'public' | 'user' | 'admin' | 'owner',
): { allowed: ParsedDirective[]; denied: ParsedDirective[] } {
    const adminOnly: Set<string> = new Set(['system', 'reset', 'max_tokens']);
    const allowed: ParsedDirective[] = [];
    const denied: ParsedDirective[] = [];

    for (const d of directives) {
        if (adminOnly.has(d.type) && userLevel !== 'admin' && userLevel !== 'owner') {
            denied.push(d);
        } else {
            allowed.push(d);
        }
    }

    return { allowed, denied };
}
