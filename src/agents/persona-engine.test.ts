/**
 * CoreBlow — Persona Engine Tests
 *
 * Tests for persona registration, activation, system messages,
 * model params, listing, and deletion.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PersonaEngine } from './persona-engine.js';

describe('PersonaEngine', () => {
    let engine: PersonaEngine;

    beforeEach(() => {
        engine = new PersonaEngine();
    });

    describe('built-in personas', () => {
        it('has default persona', () => {
            expect(engine.get('default')).not.toBeNull();
            expect(engine.get('default')!.tone).toBe('friendly');
        });

        it('has coder persona', () => {
            expect(engine.get('coder')).not.toBeNull();
            expect(engine.get('coder')!.tone).toBe('technical');
        });

        it('has analyst persona', () => {
            expect(engine.get('analyst')!.tone).toBe('professional');
        });

        it('has creative persona', () => {
            expect(engine.get('creative')!.temperature).toBe(0.9);
        });

        it('lists at least 4 built-in personas', () => {
            expect(engine.list().length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('register + get', () => {
        it('registers custom persona', () => {
            engine.register({ id: 'custom', name: 'Custom', systemPrompt: 'Be custom' });
            expect(engine.get('custom')!.name).toBe('Custom');
        });

        it('returns null for unknown', () => {
            expect(engine.get('ghost')).toBeNull();
        });
    });

    describe('activate + getActive', () => {
        it('activates persona for conversation', () => {
            expect(engine.activate('conv1', 'coder')).toBe(true);
            expect(engine.getActive('conv1')!.id).toBe('coder');
        });

        it('returns false for unknown persona', () => {
            expect(engine.activate('conv1', 'ghost')).toBe(false);
        });

        it('returns null when no active persona', () => {
            expect(engine.getActive('conv1')).toBeNull();
        });
    });

    describe('buildSystemMessages', () => {
        it('builds from active persona', () => {
            engine.activate('conv1', 'coder');
            const msgs = engine.buildSystemMessages('conv1');
            expect(msgs[0]!.content).toContain('expert software engineer');
        });

        it('falls back to default', () => {
            const msgs = engine.buildSystemMessages('conv1');
            expect(msgs[0]!.content).toContain('CoreBlow');
        });

        it('includes guardrails message', () => {
            engine.register({
                id: 'safe', name: 'Safe', systemPrompt: 'Be safe',
                guardrails: { blockedTopics: ['violence', 'drugs'] },
            });
            engine.activate('conv1', 'safe');
            const msgs = engine.buildSystemMessages('conv1');
            expect(msgs.length).toBe(2);
            expect(msgs[1]!.content).toContain('violence');
        });
    });

    describe('getModelParams', () => {
        it('returns persona temperature', () => {
            engine.activate('conv1', 'coder');
            expect(engine.getModelParams('conv1').temperature).toBe(0.3);
        });

        it('defaults to 0.7 / 4096', () => {
            const params = engine.getModelParams('conv1');
            expect(params.temperature).toBe(0.7);
            expect(params.maxTokens).toBe(4096);
        });
    });

    describe('deactivate', () => {
        it('removes active persona', () => {
            engine.activate('conv1', 'coder');
            expect(engine.deactivate('conv1')).toBe(true);
            expect(engine.getActive('conv1')).toBeNull();
        });
    });

    describe('delete', () => {
        it('prevents deleting default', () => {
            expect(engine.delete('default')).toBe(false);
        });

        it('deletes custom persona', () => {
            engine.register({ id: 'tmp', name: 'Tmp', systemPrompt: 'tmp' });
            expect(engine.delete('tmp')).toBe(true);
            expect(engine.get('tmp')).toBeNull();
        });
    });
});
