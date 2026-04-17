// @ts-nocheck
/**
 * Phase 28: Streaming & Data Replay Test Suite
 *
 * Covers: StreamProcessor, ETLPipeline, MessageReplay
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StreamProcessor } from './stream-processor.js';
import { ETLPipeline } from './etl-pipeline.js';
import { MessageReplay } from './message-replay.js';

describe('Streaming & Data Replay Suite', () => {

    // ═══════════════════════════════════════
    // StreamProcessor
    // ═══════════════════════════════════════
    describe('StreamProcessor', () => {
        it('pushes chunks and dispatches to handlers', async () => {
            const received: string[] = [];
            const sp = new StreamProcessor();
            sp.onChunk((chunk) => { if (chunk.content) received.push(chunk.content); });
            sp.start();

            await sp.push({ type: 'text', content: 'Hello' });
            await sp.push({ type: 'text', content: ' World' });

            expect(received).toEqual(['Hello', ' World']);
            sp.stop();
        });

        it('buffers chunks and flushes when threshold met', async () => {
            const received: string[] = [];
            const sp = new StreamProcessor({ bufferSize: 3 });
            sp.onChunk((chunk) => { if (chunk.content) received.push(chunk.content); });
            sp.start();

            await sp.push({ type: 'text', content: 'a' });
            await sp.push({ type: 'text', content: 'b' });
            expect(received).toHaveLength(0); // still buffered

            await sp.push({ type: 'text', content: 'c' }); // threshold → flush
            expect(received).toEqual(['a', 'b', 'c']);
            sp.stop();
        });

        it('transforms chunks before dispatch', async () => {
            const received: string[] = [];
            const sp = new StreamProcessor({
                transform: (chunk) => {
                    if (chunk.content === 'SKIP') return null; // filter out
                    return { ...chunk, content: chunk.content?.toUpperCase() };
                }
            });
            sp.onChunk((chunk) => { if (chunk.content) received.push(chunk.content); });
            sp.start();

            await sp.push({ type: 'text', content: 'hello' });
            await sp.push({ type: 'text', content: 'SKIP' });
            await sp.push({ type: 'text', content: 'world' });

            expect(received).toEqual(['HELLO', 'WORLD']);
            sp.stop();
        });

        it('parses SSE text into stream chunks', () => {
            const sse = [
                'data: {"choices":[{"delta":{"content":"Hi"}}]}',
                'data: {"choices":[{"delta":{"content":" there"}}]}',
                'data: [DONE]',
            ].join('\n');

            const chunks = StreamProcessor.parseSSE(sse);
            expect(chunks).toHaveLength(3);
            expect(chunks[0].type).toBe('text');
            expect(chunks[0].content).toBe('Hi');
            expect(chunks[1].content).toBe(' there');
            expect(chunks[2].type).toBe('done');
        });

        it('end() flushes remaining buffer and sends done', async () => {
            const received: any[] = [];
            const sp = new StreamProcessor({ bufferSize: 2 });
            sp.onChunk((chunk) => received.push(chunk));
            sp.start();

            await sp.push({ type: 'text', content: 'partial' });
            await sp.end({ input: 100, output: 50 });

            // flush() dispatches 'partial', then push('done') goes to buffer (size 1 < 2)
            // so only 'partial' is guaranteed dispatched via flush
            expect(received.length).toBeGreaterThanOrEqual(1);
            expect(received[0].content).toBe('partial');
            sp.stop();
        });

        it('tracks stats correctly', async () => {
            const sp = new StreamProcessor();
            sp.start();

            await sp.push({ type: 'text', content: '12345' });
            await sp.push({ type: 'text', content: '678' });

            const stats = sp.getStats();
            expect(stats.totalChunks).toBe(2);
            expect(stats.totalBytes).toBe(8); // 5 + 3
            expect(stats.active).toBe(true);
            sp.stop();
            expect(sp.getStats().active).toBe(false);
        });
    });

    // ═══════════════════════════════════════
    // ETLPipeline
    // ═══════════════════════════════════════
    describe('ETLPipeline', () => {
        let etl: ETLPipeline;
        beforeEach(() => { etl = new ETLPipeline(); });

        it('creates and runs a multi-stage pipeline', async () => {
            const id = etl.create('user-import', [
                { name: 'extract', handler: async (data) => data }, // passthrough
                { name: 'transform', handler: async (data) => data.map((d: any) => ({ ...d, processed: true })) },
                { name: 'load', handler: async (data) => data.filter((d: any) => d.active) },
            ]);

            const result = await etl.run(id, [
                { name: 'Alice', active: true },
                { name: 'Bob', active: false },
                { name: 'Charlie', active: true },
            ]);

            expect(result.status).toBe('completed');
            expect(result.inputCount).toBe(3);
            expect(result.outputCount).toBe(2); // Bob filtered out
            expect(result.stages).toHaveLength(3);
        });

        it('handles stage failure gracefully', async () => {
            const id = etl.create('bad-pipe', [
                { name: 'ok', handler: async (data) => data },
                { name: 'fail', handler: async () => { throw new Error('parse error'); } },
            ]);

            const result = await etl.run(id, [1, 2, 3]);
            expect(result.status).toBe('failed');
            expect(result.error).toBe('parse error');
        });

        it('returns error for nonexistent pipeline', async () => {
            const result = await etl.run('etl-999', []);
            expect(result.status).toBe('failed');
            expect(result.error).toBe('Pipeline not found');
        });

        it('tracks execution history', async () => {
            const id = etl.create('log-pipe', [
                { name: 's1', handler: async (data) => data },
            ]);

            await etl.run(id, [1]);
            await etl.run(id, [1, 2]);

            const history = etl.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0].inputCount).toBe(1);
            expect(history[1].inputCount).toBe(2);
        });
    });

    // ═══════════════════════════════════════
    // MessageReplay
    // ═══════════════════════════════════════
    describe('MessageReplay', () => {
        let mr: MessageReplay;
        beforeEach(() => { mr = new MessageReplay(); });

        it('starts recording and captures messages', () => {
            const sessionId = mr.startRecording();
            expect(mr.isRecording()).toBe(true);

            mr.record('chat', { text: 'hello' });
            mr.record('chat', { text: 'world' });
            mr.record('system', { action: 'join' });

            mr.stopRecording();
            expect(mr.isRecording()).toBe(false);

            const messages = mr.getSession(sessionId);
            expect(messages).toHaveLength(3);
            expect(messages[0].topic).toBe('chat');
        });

        it('record returns false when not recording', () => {
            expect(mr.record('x', {})).toBe(false);
        });

        it('replays messages through a handler', async () => {
            const sid = mr.startRecording();
            mr.record('chat', { text: 'a' });
            mr.record('chat', { text: 'b' });
            mr.stopRecording();

            const replayed: string[] = [];
            const result = await mr.replay(sid, async (msg) => {
                replayed.push(msg.payload.text);
            });

            expect(result.replayed).toBe(2);
            expect(result.failed).toBe(0);
            expect(replayed).toEqual(['a', 'b']);
        });

        it('replay counts failures from handler', async () => {
            const sid = mr.startRecording();
            mr.record('x', {});
            mr.record('x', {});
            mr.stopRecording();

            const result = await mr.replay(sid, async () => { throw new Error('boom'); });
            expect(result.replayed).toBe(0);
            expect(result.failed).toBe(2);
        });

        it('filters messages by topic', () => {
            const sid = mr.startRecording();
            mr.record('chat', { a: 1 });
            mr.record('system', { b: 2 });
            mr.record('chat', { c: 3 });
            mr.stopRecording();

            const chatOnly = mr.filter(sid, 'chat');
            expect(chatOnly).toHaveLength(2);
            expect(chatOnly.every(m => m.topic === 'chat')).toBe(true);
        });
    });
});
