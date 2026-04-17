/**
 * CoreBlow Phase 29 — Stream Processor Unit Tests
 *
 * Layer 1 (Class Contract) for:
 *   - StreamProcessor: chunk dispatch, buffering, transform, flush,
 *     end lifecycle, SSE parsing, stats tracking
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StreamProcessor } from '../../src/infra/stream-processor.js';
import type { StreamChunk } from '../../src/infra/stream-processor.js';

describe('StreamProcessor', () => {
    let processor: StreamProcessor;

    afterEach(() => {
        processor?.stop();
    });

    it('should dispatch chunks to handlers immediately (bufferSize=1)', async () => {
        processor = new StreamProcessor({ bufferSize: 1 });
        const received: StreamChunk[] = [];
        processor.onChunk((chunk) => { received.push(chunk); });
        processor.start();

        await processor.push({ type: 'text', content: 'Hello' });
        await processor.push({ type: 'text', content: ' World' });

        expect(received).toHaveLength(2);
        expect(received[0]!.content).toBe('Hello');
        expect(received[1]!.content).toBe(' World');
    });

    it('should buffer chunks until bufferSize is reached', async () => {
        processor = new StreamProcessor({ bufferSize: 3, flushIntervalMs: 0 });
        const received: StreamChunk[] = [];
        processor.onChunk((chunk) => { received.push(chunk); });
        processor.start();

        await processor.push({ type: 'text', content: 'a' });
        await processor.push({ type: 'text', content: 'b' });
        expect(received).toHaveLength(0); // Still buffered

        await processor.push({ type: 'text', content: 'c' });
        expect(received).toHaveLength(3); // Flushed at buffer full
    });

    it('should flush buffered chunks manually', async () => {
        processor = new StreamProcessor({ bufferSize: 10, flushIntervalMs: 0 });
        const received: StreamChunk[] = [];
        processor.onChunk((chunk) => { received.push(chunk); });
        processor.start();

        await processor.push({ type: 'text', content: 'buffered' });
        expect(received).toHaveLength(0);

        await processor.flush();
        expect(received).toHaveLength(1);
        expect(received[0]!.content).toBe('buffered');
    });

    it('should apply transform function to chunks', async () => {
        processor = new StreamProcessor({
            bufferSize: 1,
            transform: (chunk) => ({
                ...chunk,
                content: chunk.content?.toUpperCase(),
            }),
        });
        const received: StreamChunk[] = [];
        processor.onChunk((chunk) => { received.push(chunk); });
        processor.start();

        await processor.push({ type: 'text', content: 'hello' });
        expect(received[0]!.content).toBe('HELLO');
    });

    it('should filter chunks when transform returns null', async () => {
        processor = new StreamProcessor({
            bufferSize: 1,
            transform: (chunk) => chunk.content === 'skip' ? null : chunk,
        });
        const received: StreamChunk[] = [];
        processor.onChunk((chunk) => { received.push(chunk); });
        processor.start();

        await processor.push({ type: 'text', content: 'skip' });
        await processor.push({ type: 'text', content: 'keep' });

        expect(received).toHaveLength(1);
        expect(received[0]!.content).toBe('keep');
    });

    it('should handle end() lifecycle correctly', async () => {
        // bufferSize=1 ensures push() dispatches immediately (including the done chunk)
        processor = new StreamProcessor({ bufferSize: 1 });
        const received: StreamChunk[] = [];
        processor.onChunk((chunk) => { received.push(chunk); });
        processor.start();

        await processor.push({ type: 'text', content: 'data' });
        await processor.end({ input: 100, output: 50 });

        // Should have the text chunk + done chunk
        expect(received).toHaveLength(2);
        expect(received[0]!.type).toBe('text');
        expect(received[1]!.type).toBe('done');
        expect(received[1]!.finishReason).toBe('stop');
        expect(received[1]!.usage).toEqual({ input: 100, output: 50 });
    });

    it('should track stats correctly', async () => {
        processor = new StreamProcessor({ bufferSize: 1 });
        processor.onChunk(() => {});
        processor.start();

        await processor.push({ type: 'text', content: 'hello' });
        await processor.push({ type: 'text', content: 'world' });

        const stats = processor.getStats();
        expect(stats.totalChunks).toBe(2);
        expect(stats.totalBytes).toBe(10); // 'hello' (5) + 'world' (5)
        expect(stats.active).toBe(true);
        expect(stats.buffered).toBe(0); // bufferSize=1 dispatches immediately
    });

    it('should report inactive after stop()', async () => {
        processor = new StreamProcessor();
        processor.start();
        expect(processor.getStats().active).toBe(true);

        processor.stop();
        expect(processor.getStats().active).toBe(false);
    });
});

// ================================================================
// StreamProcessor.parseSSE (Static Method)
// ================================================================
describe('StreamProcessor.parseSSE', () => {
    it('should parse text content from SSE', () => {
        const sse = [
            'data: {"choices":[{"delta":{"content":"Hello"}}]}',
            'data: {"choices":[{"delta":{"content":" World"}}]}',
        ].join('\n');

        const chunks = StreamProcessor.parseSSE(sse);
        expect(chunks).toHaveLength(2);
        expect(chunks[0]!.type).toBe('text');
        expect(chunks[0]!.content).toBe('Hello');
        expect(chunks[1]!.content).toBe(' World');
    });

    it('should parse tool calls from SSE', () => {
        const sse = 'data: {"choices":[{"delta":{"tool_calls":[{"id":"call_123","function":{"name":"search","arguments":"{}"}}]}}]}';

        const chunks = StreamProcessor.parseSSE(sse);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]!.type).toBe('tool_call');
        expect(chunks[0]!.toolCallId).toBe('call_123');
        expect(chunks[0]!.toolName).toBe('search');
    });

    it('should parse [DONE] sentinel', () => {
        const sse = 'data: [DONE]';
        const chunks = StreamProcessor.parseSSE(sse);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]!.type).toBe('done');
        expect(chunks[0]!.finishReason).toBe('stop');
    });

    it('should skip non-data lines and invalid JSON', () => {
        const sse = [
            ': comment',
            'event: ping',
            'data: not-json',
            'data: {"choices":[{"delta":{"content":"ok"}}]}',
        ].join('\n');

        const chunks = StreamProcessor.parseSSE(sse);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]!.content).toBe('ok');
    });

    it('should handle empty input', () => {
        expect(StreamProcessor.parseSSE('')).toHaveLength(0);
    });

    it('should handle mixed SSE stream (text + tool_call + done)', () => {
        const sse = [
            'data: {"choices":[{"delta":{"content":"Thinking..."}}]}',
            'data: {"choices":[{"delta":{"tool_calls":[{"id":"c1","function":{"name":"calc","arguments":"1+1"}}]}}]}',
            'data: {"choices":[{"delta":{"content":"Result: 2"}}]}',
            'data: [DONE]',
        ].join('\n');

        const chunks = StreamProcessor.parseSSE(sse);
        expect(chunks).toHaveLength(4);
        expect(chunks.map(c => c.type)).toEqual(['text', 'tool_call', 'text', 'done']);
    });
});
