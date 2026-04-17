/**
 * agents/turn-controller.test.ts
 */
import { describe, it, expect } from 'vitest';
import { TurnController } from './turn-controller.js';
import { BudgetTracker } from './bootstrap-budget.js';
import type { ContentBlock } from './content-blocks.js';

describe('Turn Controller', () => {
    it('starts in idle', () => {
        const tc = new TurnController('t1');
        expect(tc.getState().phase).toBe('idle');
    });

    it('transitions through thinking', () => {
        const tc = new TurnController('t1');
        tc.start();
        expect(tc.getState().phase).toBe('thinking');
    });

    it('completes on text-only response', () => {
        const tc = new TurnController('t1');
        tc.start();
        const result = tc.processResponse('Hello world');
        expect(result.continueLoop).toBe(false);
        expect(tc.getState().phase).toBe('complete');
    });

    it('continues loop on tool use', () => {
        const tc = new TurnController('t1');
        tc.start();
        const blocks: ContentBlock[] = [
            { type: 'text', text: 'Let me check' },
            { type: 'tool_use', id: 'tc1', name: 'read', input: { path: '/file' } },
        ];
        const result = tc.processResponse(blocks);
        expect(result.continueLoop).toBe(true);
        expect(result.toolUseBlocks).toHaveLength(1);
        expect(tc.getState().phase).toBe('tool_use');
    });

    it('enforces max tool calls', () => {
        const tc = new TurnController('t1', { maxToolCallsPerTurn: 2 });
        tc.start();
        const makeToolUse = (id: string): ContentBlock[] => [
            { type: 'tool_use', id, name: 'read', input: {} },
        ];
        tc.processResponse(makeToolUse('1'));
        tc.processResponse(makeToolUse('2'));
        const result = tc.processResponse(makeToolUse('3'));
        expect(result.continueLoop).toBe(false);
        expect(tc.getState().phase).toBe('error');
        expect(tc.getState().error).toContain('Max tool calls');
    });

    it('enforces budget', () => {
        const budget = new BudgetTracker({ maxTokensPerTurn: 100 });
        budget.record({ inputTokens: 60, outputTokens: 50 }); // exceed
        const tc = new TurnController('t1', {}, budget);
        tc.start();
        const blocks: ContentBlock[] = [{ type: 'tool_use', id: '1', name: 'read', input: {} }];
        const result = tc.processResponse(blocks);
        expect(result.continueLoop).toBe(false);
        expect(tc.getState().phase).toBe('budget_exceeded');
    });

    it('records tokens', () => {
        const tc = new TurnController('t1');
        tc.recordTokens(1000, 500);
        expect(tc.getState().tokensUsed).toBe(1500);
    });

    it('fails explicitly', () => {
        const tc = new TurnController('t1');
        tc.start();
        tc.fail('something broke');
        expect(tc.getState().phase).toBe('error');
        expect(tc.getState().error).toBe('something broke');
    });

    it('tracks duration', () => {
        const tc = new TurnController('t1');
        tc.start();
        expect(tc.durationMs()).toBeGreaterThanOrEqual(0);
    });

    it('fires phase change callback', () => {
        const phases: string[] = [];
        const tc = new TurnController('t1');
        tc.setOnPhaseChange((p) => phases.push(p));
        tc.start();
        tc.processResponse('done');
        expect(phases).toEqual(['thinking', 'complete']);
    });
});
