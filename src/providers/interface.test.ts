import { describe, it, expect } from 'vitest';
import type {
    AIProvider,
    ChatMessage,
    ProviderOptions,
    ProviderTool,
    StreamChunk,
    TokenUsage,
    ToolCall,
} from './interface.js';

describe('ChatMessage interface', () => {
    it('supports all role types', () => {
        const messages: ChatMessage[] = [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' },
            { role: 'tool', content: '{}', tool_call_id: 'tc_1' },
        ];
        expect(messages).toHaveLength(4);
        expect(messages[3].tool_call_id).toBe('tc_1');
    });

    it('supports tool_calls on assistant messages', () => {
        const tc: ToolCall = {
            id: 'call_1',
            type: 'function',
            function: { name: 'search', arguments: '{"q":"test"}' },
        };
        const msg: ChatMessage = { role: 'assistant', content: '', tool_calls: [tc] };
        expect(msg.tool_calls![0].function.name).toBe('search');
    });
});

describe('ProviderOptions interface', () => {
    it('accepts all option fields', () => {
        const opts: ProviderOptions = {
            model: 'gpt-5',
            temperature: 0.8,
            maxTokens: 4096,
            topP: 0.9,
            frequencyPenalty: 0.1,
            presencePenalty: 0.2,
            stop: ['\n'],
            stream: true,
            responseFormat: { type: 'json_object' },
        };
        expect(opts.model).toBe('gpt-5');
        expect(opts.maxTokens).toBe(4096);
    });

    it('supports tool definitions', () => {
        const tool: ProviderTool = {
            type: 'function',
            function: {
                name: 'get_weather',
                description: 'Get the weather for a location',
                parameters: { type: 'object', properties: { location: { type: 'string' } } },
            },
        };
        const opts: ProviderOptions = { tools: [tool] };
        expect(opts.tools![0].function.name).toBe('get_weather');
    });
});

describe('StreamChunk union type', () => {
    it('text chunk carries content', () => {
        const chunk: StreamChunk = { type: 'text', content: 'Hello' };
        expect(chunk.type).toBe('text');
        if (chunk.type === 'text') expect(chunk.content).toBe('Hello');
    });

    it('tool_call chunk carries toolCall', () => {
        const chunk: StreamChunk = {
            type: 'tool_call',
            toolCall: { id: 'tc_1', type: 'function', function: { name: 'fn', arguments: '{}' } },
        };
        if (chunk.type === 'tool_call') expect(chunk.toolCall.id).toBe('tc_1');
    });

    it('done chunk optionally carries usage', () => {
        const usage: TokenUsage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
        const chunk: StreamChunk = { type: 'done', usage };
        if (chunk.type === 'done') expect(chunk.usage?.totalTokens).toBe(30);
    });

    it('error chunk carries error message', () => {
        const chunk: StreamChunk = { type: 'error', error: 'rate limit exceeded' };
        if (chunk.type === 'error') expect(chunk.error).toContain('rate limit');
    });
});

describe('AIProvider interface contract', () => {
    it('mock provider implements the interface', async () => {
        const mock: AIProvider = {
            name: 'test-provider',
            async *chat() { yield { type: 'text', content: 'hello' }; yield { type: 'done' }; },
            isAvailable: async () => true,
            listModels: () => ['model-a', 'model-b'],
        };
        expect(mock.name).toBe('test-provider');
        expect(await mock.isAvailable()).toBe(true);
        expect(mock.listModels()).toEqual(['model-a', 'model-b']);

        const chunks: StreamChunk[] = [];
        for await (const chunk of mock.chat([], {})) chunks.push(chunk);
        expect(chunks).toHaveLength(2);
        expect(chunks[0].type).toBe('text');
    });
});
