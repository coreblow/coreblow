/**
 * agents/provider-stream.ts
 * Provider streaming abstraction for SSE/WebSocket LLM responses.
 */
export interface StreamChunk { type: 'text' | 'tool_use' | 'thinking' | 'error' | 'done'; content?: string; toolUse?: { id: string; name: string; input: Record<string, unknown> }; usage?: { inputTokens: number; outputTokens: number }; }
export type StreamHandler = (chunk: StreamChunk) => void;

export class StreamAccumulator {
    private textParts: string[] = [];
    private toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    private thinking = '';
    private error: string | null = null;
    private totalInput = 0;
    private totalOutput = 0;

    onChunk(chunk: StreamChunk): void {
        switch (chunk.type) {
            case 'text': if (chunk.content) this.textParts.push(chunk.content); break;
            case 'tool_use': if (chunk.toolUse) this.toolUses.push(chunk.toolUse); break;
            case 'thinking': if (chunk.content) this.thinking += chunk.content; break;
            case 'error': this.error = chunk.content ?? 'Unknown error'; break;
            case 'done': if (chunk.usage) { this.totalInput += chunk.usage.inputTokens; this.totalOutput += chunk.usage.outputTokens; } break;
        }
    }

    getText(): string { return this.textParts.join(''); }
    getToolUses(): Array<{ id: string; name: string; input: Record<string, unknown> }> { return this.toolUses; }
    getThinking(): string { return this.thinking; }
    getError(): string | null { return this.error; }
    getUsage(): { inputTokens: number; outputTokens: number } { return { inputTokens: this.totalInput, outputTokens: this.totalOutput }; }
    hasToolUse(): boolean { return this.toolUses.length > 0; }
    hasError(): boolean { return this.error !== null; }
    reset(): void { this.textParts = []; this.toolUses = []; this.thinking = ''; this.error = null; this.totalInput = 0; this.totalOutput = 0; }
}
