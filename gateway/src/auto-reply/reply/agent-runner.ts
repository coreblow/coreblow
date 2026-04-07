/**
 * auto-reply/reply/agent-runner.ts
 * Orchestrate tool calls within a reply cycle.
 * Follows CoreBlow's agent-runner.ts + agent-runner-execution.ts pattern.
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('reply:agent-runner');

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolResult {
    toolCallId: string;
    name: string;
    content: string;
    isError: boolean;
}

export interface AgentRunnerOptions {
    maxIterations: number;
    maxToolCalls: number;
    timeoutMs: number;
    requireApproval: boolean;
}

export interface AgentRunResult {
    finalResponse: string;
    toolCallsExecuted: number;
    iterations: number;
    totalTokens: number;
    abortReason?: string;
}

type GenerateFn = (messages: unknown[]) => Promise<{
    content: string | null;
    toolCalls?: ToolCall[];
    usage: { total_tokens: number };
}>;

type ExecuteToolFn = (call: ToolCall) => Promise<ToolResult>;

const DEFAULT_OPTIONS: AgentRunnerOptions = {
    maxIterations: 25,
    maxToolCalls: 100,
    timeoutMs: 300_000,
    requireApproval: false,
};

export class AgentRunner {
    private aborted = false;
    private totalToolCalls = 0;
    private totalTokens = 0;

    constructor(private readonly opts: AgentRunnerOptions = DEFAULT_OPTIONS) {}

    /** Run the agent loop: generate → tool calls → inject results → repeat. */
    async run(
        messages: Array<{ role: string; content: string }>,
        generateFn: GenerateFn,
        executeToolFn: ExecuteToolFn,
    ): Promise<AgentRunResult> {
        const startTime = Date.now();
        let iteration = 0;
        const conversationMessages = [...messages];

        while (iteration < this.opts.maxIterations && !this.aborted) {
            // Check timeout
            if (Date.now() - startTime > this.opts.timeoutMs) {
                return this.buildResult(conversationMessages, iteration, 'timeout');
            }

            iteration++;
            const response = await generateFn(conversationMessages);
            this.totalTokens += response.usage.total_tokens;

            // No tool calls — we have the final response
            if (!response.toolCalls || response.toolCalls.length === 0) {
                if (response.content) {
                    conversationMessages.push({ role: 'assistant', content: response.content });
                }
                return this.buildResult(conversationMessages, iteration);
            }

            // Tool call guard
            if (this.totalToolCalls + response.toolCalls.length > this.opts.maxToolCalls) {
                return this.buildResult(conversationMessages, iteration, 'max_tool_calls');
            }

            // Add assistant message with tool calls
            conversationMessages.push({ role: 'assistant', content: response.content ?? '' });

            // Execute all tool calls
            for (const call of response.toolCalls) {
                if (this.aborted) break;
                log.debug({ tool: call.name, iteration }, 'Executing tool call');

                const result = await executeToolFn(call);
                this.totalToolCalls++;

                conversationMessages.push({ role: 'tool' as string, content: result.content });
            }
        }

        return this.buildResult(conversationMessages, iteration,
            this.aborted ? 'aborted' : 'max_iterations');
    }

    /** Abort the current run. */
    abort(): void {
        this.aborted = true;
        log.info('Agent run aborted');
    }

    private buildResult(messages: unknown[], iterations: number, abortReason?: string): AgentRunResult {
        const lastAssistant = [...(messages as Array<{ role: string; content: string }>)]
            .reverse().find(m => m.role === 'assistant');
        return {
            finalResponse: lastAssistant?.content ?? '',
            toolCallsExecuted: this.totalToolCalls,
            iterations,
            totalTokens: this.totalTokens,
            abortReason,
        };
    }
}
