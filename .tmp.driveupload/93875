/**
 * CoreBlow Phase 41 — Tool Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   Registry (OpenAI definition) → Execution → History → Stats
 */
import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import { ToolExecutor } from '../../src/tools/tool-executor.js';

describe('Phase41 Chain: Tool Pipeline', () => {
    it('register tool → parse schemas → execute → check history', async () => {
        const registry = new ToolRegistry();
        const executor = new ToolExecutor(registry);

        // Step 1: Register tools
        registry.register({
            name: 'getWeather',
            description: 'Get local weather',
            parameters: { type: 'object', properties: { location: { type: 'string' } } },
            handler: async (args) => `Weather for ${args['location']} is sunny`,
            category: 'utility',
        });

        // Step 2: Extract OpenAI compatible schemas for LLM
        const openaiSchemas = registry.toOpenAI();
        expect(openaiSchemas).toHaveLength(1);
        expect(openaiSchemas[0]?.function.name).toBe('getWeather');

        // Step 3: Simulated LLM decides to call the tool
        const result = await executor.execute('getWeather', { location: 'Tokyo' }, 'call_123');
        expect(result.success).toBe(true);
        expect(result.output).toBe('Weather for Tokyo is sunny');

        // Step 4: Check history and stats
        const history = executor.getHistory();
        expect(history).toHaveLength(1);
        expect(history[0]?.toolName).toBe('getWeather');
        expect(history[0]?.callId).toBe('call_123');

        const stats = executor.getStats();
        expect(stats.totalCalls).toBe(1);
        expect(stats.successRate).toBe(1);
    });
});
