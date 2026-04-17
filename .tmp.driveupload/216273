/**
 * auto-reply/rules.test.ts — Reply rule engine tests
 */
import { describe, it, expect } from 'vitest';
import { matchesRule, findMatchingRule, expandTemplate, type ReplyRule } from './rules.js';

const makeRule = (overrides: Partial<ReplyRule>): ReplyRule => ({
    id: 'r1', name: 'test', priority: 0, enabled: true,
    condition: { type: 'contains', pattern: 'hello' },
    response: { template: 'Hi!' },
    ...overrides,
});

describe('Reply Rules', () => {
    describe('matchesRule', () => {
        it('matches exact', () => {
            const rule = makeRule({ condition: { type: 'exact', pattern: 'hello' } });
            expect(matchesRule(rule, 'hello')).toBe(true);
            expect(matchesRule(rule, 'Hello')).toBe(true);
            expect(matchesRule(rule, 'hello world')).toBe(false);
        });

        it('matches startsWith', () => {
            const rule = makeRule({ condition: { type: 'startsWith', pattern: '/help' } });
            expect(matchesRule(rule, '/help')).toBe(true);
            expect(matchesRule(rule, '/help me')).toBe(true);
            expect(matchesRule(rule, 'please /help')).toBe(false);
        });

        it('matches contains', () => {
            const rule = makeRule({ condition: { type: 'contains', pattern: 'hello' } });
            expect(matchesRule(rule, 'say hello world')).toBe(true);
            expect(matchesRule(rule, 'goodbye')).toBe(false);
        });

        it('matches keyword', () => {
            const rule = makeRule({ condition: { type: 'keyword', pattern: 'help|status' } });
            expect(matchesRule(rule, 'I need help')).toBe(true);
            expect(matchesRule(rule, 'check status')).toBe(true);
            expect(matchesRule(rule, 'helping')).toBe(false);
        });

        it('matches regex', () => {
            const rule = makeRule({ condition: { type: 'regex', pattern: '^/\\w+ \\d+$' } });
            expect(matchesRule(rule, '/cmd 123')).toBe(true);
            expect(matchesRule(rule, 'hello')).toBe(false);
        });

        it('handles invalid regex safely', () => {
            const rule = makeRule({ condition: { type: 'regex', pattern: '[invalid' } });
            expect(matchesRule(rule, 'test')).toBe(false);
        });

        it('skips disabled rules', () => {
            const rule = makeRule({ enabled: false });
            expect(matchesRule(rule, 'hello')).toBe(false);
        });

        it('checks channel constraint', () => {
            const rule = makeRule({ condition: { type: 'contains', pattern: 'hi', channel: 'discord' } });
            expect(matchesRule(rule, 'hi', { channel: 'discord' })).toBe(true);
            expect(matchesRule(rule, 'hi', { channel: 'telegram' })).toBe(false);
        });

        it('checks sender constraint', () => {
            const rule = makeRule({ condition: { type: 'contains', pattern: 'hi', sender: 'admin' } });
            expect(matchesRule(rule, 'hi', { sender: 'admin' })).toBe(true);
            expect(matchesRule(rule, 'hi', { sender: 'user' })).toBe(false);
        });
    });

    describe('findMatchingRule', () => {
        it('returns highest priority match', () => {
            const rules = [
                makeRule({ id: 'low', priority: 1, condition: { type: 'contains', pattern: 'test' } }),
                makeRule({ id: 'high', priority: 10, condition: { type: 'contains', pattern: 'test' } }),
            ];
            const match = findMatchingRule(rules, 'test message');
            expect(match?.id).toBe('high');
        });

        it('returns undefined when no match', () => {
            const rules = [makeRule({ condition: { type: 'exact', pattern: 'xyz' } })];
            expect(findMatchingRule(rules, 'hello')).toBeUndefined();
        });
    });

    describe('expandTemplate', () => {
        it('expands variables', () => {
            expect(expandTemplate('Hello {{name}}, welcome to {{channel}}!', { name: 'Alice', channel: '#general' }))
                .toBe('Hello Alice, welcome to #general!');
        });

        it('keeps unknown variables as-is', () => {
            expect(expandTemplate('Hello {{name}}!', {})).toBe('Hello {{name}}!');
        });
    });
});
