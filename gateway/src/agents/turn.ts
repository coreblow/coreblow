/**
 * src/agents/turn.ts
 * Agent turn loop — message → system prompt → model → tools → response
 */

import { getConfig } from '../gateway/config.js';
import { AgentManager } from './manager.js';
import type { ChatMessage, StreamChunk, ToolDefinition } from '../providers/interface.js';
import type { InboundMessage, MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('turn');

const MAX_TOOL_ROUNDS = 5;

// Tool executor function type
type ToolExecutor = (name: string, args: Record<string, any>) => Promise<string>;

export class AgentTurn {
    private manager: AgentManager;
    private router: MessageRouter;
    private toolExecutor?: ToolExecutor;

    constructor(manager: AgentManager, router: MessageRouter) {
        this.manager = manager;
        this.router = router;
    }

    /**
     * Register a tool executor for handling tool calls
     */
    setToolExecutor(executor: ToolExecutor) {
        this.toolExecutor = executor;
    }

    /**
     * Run a full turn: message → model → (tools → model)* → response
     */
    async runTurn(inbound: InboundMessage): Promise<string> {
        const config = getConfig();
        const sessionId = inbound.sessionId;

        log.info({
            channel: inbound.channel,
            sender: inbound.senderName,
            session: sessionId,
            textLength: inbound.text.length,
        }, 'Starting turn');

        // Get or build system prompt
        const systemPrompt = await this.manager.getSystemPrompt();

        // Get session history
        const history = this.manager.sessions.getContextWindow(sessionId, 40);

        // If this is a new session, add system message
        if (history.length === 0 || history[0].role !== 'system') {
            const systemMsg: ChatMessage = { role: 'system', content: systemPrompt };
            this.manager.sessions.appendMessage(sessionId, systemMsg);
            history.unshift(systemMsg);
        }

        // Append user message
        const userMsg: ChatMessage = { role: 'user', content: inbound.text };
        this.manager.sessions.appendMessage(sessionId, userMsg);
        history.push(userMsg);

        // Get provider
        const provider = this.manager.getProvider();
        const tools = this.manager.skills.getToolDefinitions();

        // Run inference loop (may have multiple rounds if tools are called)
        let fullResponse = '';
        let round = 0;
        let messages = [...history];

        while (round < MAX_TOOL_ROUNDS) {
            round++;

            const chunks: StreamChunk[] = [];
            let textContent = '';
            let hasToolCalls = false;

            // Stream from model
            const chatResult = provider.chat(messages, {
                model: config.agent.model,
                maxTokens: config.agent.maxTokens,
                temperature: config.agent.temperature,
                tools: tools.length > 0 ? tools : undefined,
            });

            // Handle both streaming and non-streaming providers
            const stream = Symbol.asyncIterator in Object(chatResult)
                ? (chatResult as AsyncIterable<StreamChunk>)
                : (async function* () {
                    const res = await (chatResult as any);
                    yield { type: 'text' as const, content: res.text } satisfies StreamChunk;
                    if (res.toolCalls) for (const tc of res.toolCalls) yield { type: 'tool_call' as const, toolCall: tc } satisfies StreamChunk;
                    yield { type: 'done' as const, usage: res.usage } satisfies StreamChunk;
                })();

            for await (const chunk of stream) {
                chunks.push(chunk);

                if (chunk.type === 'text' && chunk.content) {
                    textContent += chunk.content;
                }

                if (chunk.type === 'tool_call') {
                    hasToolCalls = true;
                }

                if (chunk.type === 'error') {
                    log.error({ error: chunk.error }, 'Provider error');
                    return `⚠️ AI Error: ${chunk.error}`;
                }
            }

            // If no tool calls, we're done — return the text
            if (!hasToolCalls) {
                fullResponse = textContent;
                break;
            }

            // Process tool calls
            const toolCalls = chunks.filter((c) => c.type === 'tool_call');

            // Add assistant message with tool calls
            const assistantMsg: ChatMessage = {
                role: 'assistant',
                content: textContent || '',
                tool_calls: toolCalls.map((tc) => tc.toolCall!),
            };
            messages.push(assistantMsg);
            this.manager.sessions.appendMessage(sessionId, assistantMsg);

            // Execute each tool
            for (const tc of toolCalls) {
                const call = tc.toolCall!;
                let result = '';

                if (this.toolExecutor) {
                    try {
                        const args = JSON.parse(call.function.arguments);
                        log.info({ tool: call.function.name, args }, 'Executing tool');
                        result = await this.toolExecutor(call.function.name, args);
                    } catch (err: any) {
                        result = `Error: ${err.message}`;
                        log.error({ tool: call.function.name, err: err.message }, 'Tool execution failed');
                    }
                } else {
                    result = `Tool "${call.function.name}" is not available`;
                }

                // Add tool result to messages
                const toolMsg: ChatMessage = {
                    role: 'tool',
                    content: result,
                    tool_call_id: call.id,
                };
                messages.push(toolMsg);
                this.manager.sessions.appendMessage(sessionId, toolMsg);
            }

            log.info({ round, toolCalls: toolCalls.length }, 'Tool round complete, continuing...');
        }

        // Append the final response
        if (fullResponse) {
            const assistantMsg: ChatMessage = { role: 'assistant', content: fullResponse };
            this.manager.sessions.appendMessage(sessionId, assistantMsg);
        }

        log.info({
            session: sessionId,
            rounds: round,
            responseLength: fullResponse.length,
        }, 'Turn complete');

        // Send reply back through the channel
        await this.router.sendReply({
            channel: inbound.channel,
            senderId: inbound.senderId,
            groupId: inbound.groupId,
            text: fullResponse || '(No response generated)',
        });

        return fullResponse;
    }
}
