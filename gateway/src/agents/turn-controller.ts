/**
 * agents/turn-controller.ts
 * Agent turn lifecycle controller.
 * Ported from CoreBlow src/agents/turn-controller.ts.
 */

import type { ContentBlock } from './content-blocks.js';
import { normalizeContent, extractToolUses, extractText, hasToolUse } from './content-blocks.js';
import type { BudgetTracker } from './bootstrap-budget.js';

export type TurnPhase = 'idle' | 'thinking' | 'tool_use' | 'responding' | 'complete' | 'error' | 'budget_exceeded';

export interface TurnState {
    turnId: string;
    phase: TurnPhase;
    startedAt: number;
    completedAt?: number;
    toolCalls: number;
    tokensUsed: number;
    error?: string;
}

export interface TurnControllerConfig {
    maxToolCallsPerTurn: number;
    maxTurnDurationMs: number;
    autoCompleteOnNoToolUse: boolean;
}

const DEFAULT_CONFIG: TurnControllerConfig = {
    maxToolCallsPerTurn: 50,
    maxTurnDurationMs: 300_000, // 5 min
    autoCompleteOnNoToolUse: true,
};

export class TurnController {
    private state: TurnState;
    private config: TurnControllerConfig;
    private budgetTracker?: BudgetTracker;
    private onPhaseChange?: (phase: TurnPhase) => void;

    constructor(turnId: string, config?: Partial<TurnControllerConfig>, budgetTracker?: BudgetTracker) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.budgetTracker = budgetTracker;
        this.state = {
            turnId,
            phase: 'idle',
            startedAt: Date.now(),
            toolCalls: 0,
            tokensUsed: 0,
        };
    }

    setOnPhaseChange(handler: (phase: TurnPhase) => void): void {
        this.onPhaseChange = handler;
    }

    start(): void {
        this.transition('thinking');
    }

    /**
     * Process an assistant response (content blocks from LLM).
     * Returns whether to continue the loop (tool use requires continuation).
     */
    processResponse(content: string | ContentBlock[]): { continueLoop: boolean; toolUseBlocks: ContentBlock[] } {
        const blocks = normalizeContent(content);
        const toolUses = extractToolUses(blocks);

        if (toolUses.length > 0) {
            this.state.toolCalls += toolUses.length;
            this.transition('tool_use');

            // Check budget
            if (this.budgetTracker?.isExceeded()) {
                this.transition('budget_exceeded');
                return { continueLoop: false, toolUseBlocks: [] };
            }

            // Check max tool calls
            if (this.state.toolCalls > this.config.maxToolCallsPerTurn) {
                this.transition('error');
                this.state.error = `Max tool calls exceeded: ${this.state.toolCalls} > ${this.config.maxToolCallsPerTurn}`;
                return { continueLoop: false, toolUseBlocks: [] };
            }

            // Check duration
            if (Date.now() - this.state.startedAt > this.config.maxTurnDurationMs) {
                this.transition('error');
                this.state.error = `Turn duration exceeded: ${Date.now() - this.state.startedAt}ms`;
                return { continueLoop: false, toolUseBlocks: [] };
            }

            return { continueLoop: true, toolUseBlocks: toolUses };
        }

        // No tool use — complete
        if (this.config.autoCompleteOnNoToolUse) {
            this.complete();
        } else {
            this.transition('responding');
        }
        return { continueLoop: false, toolUseBlocks: [] };
    }

    /**
     * Record token usage.
     */
    recordTokens(inputTokens: number, outputTokens: number, cost?: number): void {
        this.state.tokensUsed += inputTokens + outputTokens;
        this.budgetTracker?.record({ inputTokens, outputTokens, cost });
    }

    complete(): void {
        this.state.completedAt = Date.now();
        this.transition('complete');
    }

    fail(error: string): void {
        this.state.error = error;
        this.state.completedAt = Date.now();
        this.transition('error');
    }

    getState(): Readonly<TurnState> { return { ...this.state }; }

    isComplete(): boolean { return this.state.phase === 'complete' || this.state.phase === 'error' || this.state.phase === 'budget_exceeded'; }

    durationMs(): number { return (this.state.completedAt ?? Date.now()) - this.state.startedAt; }

    private transition(phase: TurnPhase): void {
        this.state.phase = phase;
        this.onPhaseChange?.(phase);
    }
}
