import { describe, it, expect } from 'vitest';
import { aggregateHealth, formatHealthReport } from '../../src/flows/doctor-health.js';
import { createSetupFlow, advanceSetupFlow, getSetupPrompt } from '../../src/flows/channel-setup-flow.js';
import { rankModels, formatModelComparison } from '../../src/flows/model-picker.js';
import type { ModelCandidate } from '../../src/flows/model-picker.js';

describe('Wave 47: Flows Engine Components', () => {

    describe('doctor-health.ts', () => {
        it('aggregateHealth determines overall status', () => {
            const allHealthy = aggregateHealth([
                { component: 'A', status: 'healthy', message: 'OK' },
                { component: 'B', status: 'healthy', message: 'OK' }
            ]);
            expect(allHealthy.overall).toBe('healthy');

            const oneDegraded = aggregateHealth([
                { component: 'A', status: 'healthy', message: 'OK' },
                { component: 'B', status: 'degraded', message: 'Slow' }
            ]);
            expect(oneDegraded.overall).toBe('degraded');

            const oneUnhealthy = aggregateHealth([
                { component: 'A', status: 'healthy', message: 'OK' },
                { component: 'B', status: 'degraded', message: 'Slow' },
                { component: 'C', status: 'unhealthy', message: 'Down' }
            ]);
            expect(oneUnhealthy.overall).toBe('unhealthy');
        });

        it('formatHealthReport outputs correct string', () => {
            const report = formatHealthReport([
                { component: 'DB', status: 'healthy', message: 'OK', latencyMs: 12 },
                { component: 'Cache', status: 'unhealthy', message: 'Timeout' }
            ]);
            expect(report).toContain('🔴 System: UNHEALTHY');
            expect(report).toContain('🟢 DB: OK (12ms)');
            expect(report).toContain('🔴 Cache: Timeout');
        });
    });

    describe('channel-setup-flow.ts', () => {
        it('transitions through setup phases', () => {
            let state = createSetupFlow();
            expect(state.phase).toBe('select');
            expect(getSetupPrompt(state)).toContain('Select channel');

            state = advanceSetupFlow(state, 'slack');
            expect(state.phase).toBe('credentials');
            expect(state.channel).toBe('slack');

            state.credentials = { token: 'xoxb-1', signingSecret: 'sec-1' };
            state = advanceSetupFlow(state); // Moves to validate
            state = advanceSetupFlow(state); // Processes validation -> moves to test
            expect(state.phase).toBe('test'); // Validated correctly

            state = advanceSetupFlow(state); // from test -> enable
            expect(state.phase).toBe('enable');
            expect(state.testResult?.success).toBe(true);

            state = advanceSetupFlow(state); // from enable -> complete
            expect(state.phase).toBe('complete');
        });

        it('invalidates missing credentials', () => {
            let state = createSetupFlow();
            state = advanceSetupFlow(state, 'slack'); // Now in credentials
            
            // Missing signingSecret
            state.credentials = { token: 'xoxb-1' };
            state = advanceSetupFlow(state); // Moves to validate
            state = advanceSetupFlow(state); // Processes validation -> stays in validate
            
            expect(state.phase).toBe('validate'); // Stuck
            expect(state.validationErrors).toContain('Signing secret is required');
        });
    });

    describe('model-picker.ts', () => {
        const models: ModelCandidate[] = [
            { id: 'gpt-4', provider: 'openai', contextWindow: 8000, costPer1k: 0.03, speed: 'medium', capabilities: ['vision', 'tools'] },
            { id: 'gpt-3.5', provider: 'openai', contextWindow: 4000, costPer1k: 0.002, speed: 'fast', capabilities: ['tools'] },
            { id: 'claude-3-opus', provider: 'anthropic', contextWindow: 200000, costPer1k: 0.015, speed: 'slow', capabilities: ['vision', 'tools', 'long-context'] }
        ];

        it('ranks models correctly by priority', () => {
            // By Cost
            const byCost = rankModels(models, { priority: 'cost' });
            expect(byCost[0].id).toBe('gpt-3.5');
            
            // By Speed
            const bySpeed = rankModels(models, { priority: 'speed' });
            expect(bySpeed[0].id).toBe('gpt-3.5');
            expect(bySpeed[2].id).toBe('claude-3-opus');

            // By Context Window
            const byContext = rankModels(models, { priority: 'context' });
            expect(byContext[0].id).toBe('claude-3-opus');
            
            // By Capabilities
            const byCaps = rankModels(models, { priority: 'capabilities' });
            expect(byCaps[0].id).toBe('claude-3-opus'); // 3 caps
            expect(byCaps[2].id).toBe('gpt-3.5'); // 1 cap
        });

        it('filters models by required capabilities', () => {
            const filtered = rankModels(models, { priority: 'cost', requiredCaps: ['vision'] });
            expect(filtered).toHaveLength(2); // gpt-4, claude
            expect(filtered.find(m => m.id === 'gpt-3.5')).toBeUndefined();
        });

        it('formatModelComparison builds table', () => {
            const table = formatModelComparison(models);
            expect(table).toContain('gpt-4');
            expect(table).toContain('$0.0300');
            expect(table).toContain('200K');
        });
    });
});
