// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { PersonaEngine } from './persona-engine.js';
import { isDuplicateAnnounce, buildAnnounceKey, clearAnnounceCache } from './announce-idempotency.js';

describe('Agents — Phase 8', () => {

    // ─── Persona Engine ────────────────────────────────────────

    describe('PersonaEngine', () => {
        let engine: PersonaEngine;

        beforeEach(() => {
            engine = new PersonaEngine();
        });

        it('has built-in personas', () => {
            expect(engine.get('default')).not.toBeNull();
            expect(engine.get('coder')).not.toBeNull();
            expect(engine.get('analyst')).not.toBeNull();
            expect(engine.get('creative')).not.toBeNull();
        });

        it('default persona has correct properties', () => {
            const p = engine.get('default')!;
            expect(p.name).toBe('CoreBlow Assistant');
            expect(p.tone).toBe('friendly');
            expect(p.systemPrompt).toContain('CoreBlow');
        });

        it('registers custom persona', () => {
            engine.register({
                id: 'teacher',
                name: 'Teacher',
                systemPrompt: 'You are a patient teacher.',
                tone: 'friendly',
            });
            expect(engine.get('teacher')).not.toBeNull();
        });

        it('activates persona for conversation', () => {
            expect(engine.activate('conv-1', 'coder')).toBe(true);
            expect(engine.getActive('conv-1')!.id).toBe('coder');
        });

        it('returns null for unknown persona', () => {
            expect(engine.activate('conv-1', 'nonexistent')).toBe(false);
        });

        it('buildSystemMessages includes system prompt', () => {
            engine.activate('conv-1', 'coder');
            const msgs = engine.buildSystemMessages('conv-1');
            expect(msgs.length).toBeGreaterThanOrEqual(1);
            expect(msgs[0]!.role).toBe('system');
            expect(msgs[0]!.content).toContain('software engineer');
        });

        it('buildSystemMessages adds guardrails', () => {
            engine.register({
                id: 'safe',
                name: 'Safe Bot',
                systemPrompt: 'Be safe',
                guardrails: { blockedTopics: ['violence', 'drugs'] },
            });
            engine.activate('conv-1', 'safe');
            const msgs = engine.buildSystemMessages('conv-1');
            expect(msgs.some(m => m.content.includes('violence'))).toBe(true);
        });

        it('getModelParams returns persona-specific params', () => {
            engine.activate('conv-1', 'coder');
            const params = engine.getModelParams('conv-1');
            expect(params.temperature).toBe(0.3); // coder is low temp
        });

        it('getModelParams defaults for unknown conv', () => {
            const params = engine.getModelParams('unknown-conv');
            expect(params.temperature).toBe(0.7);
        });

        it('deactivates persona', () => {
            engine.activate('conv-1', 'coder');
            engine.deactivate('conv-1');
            expect(engine.getActive('conv-1')).toBeNull();
        });

        it('list returns all personas', () => {
            const list = engine.list();
            expect(list.length).toBeGreaterThanOrEqual(4);
            expect(list.map(p => p.id)).toContain('default');
        });

        it('cannot delete default persona', () => {
            expect(engine.delete('default')).toBe(false);
            expect(engine.get('default')).not.toBeNull();
        });

        it('can delete custom persona', () => {
            engine.register({ id: 'temp', name: 'Temp', systemPrompt: 'test' });
            expect(engine.delete('temp')).toBe(true);
            expect(engine.get('temp')).toBeNull();
        });
    });

    // ─── Announce Idempotency ──────────────────────────────────

    describe('AnnounceIdempotency', () => {
        beforeEach(() => {
            clearAnnounceCache();
        });

        it('first call is not duplicate', () => {
            expect(isDuplicateAnnounce('key-1')).toBe(false);
        });

        it('second call IS duplicate', () => {
            isDuplicateAnnounce('key-1');
            expect(isDuplicateAnnounce('key-1')).toBe(true);
        });

        it('different keys are independent', () => {
            isDuplicateAnnounce('a');
            expect(isDuplicateAnnounce('b')).toBe(false);
        });

        it('buildAnnounceKey produces composite key', () => {
            const key = buildAnnounceKey('sess-1', 'sub-2', 'msg-3');
            expect(key).toBe('sess-1:sub-2:msg-3');
        });

        it('clearAnnounceCache resets all', () => {
            isDuplicateAnnounce('x');
            clearAnnounceCache();
            expect(isDuplicateAnnounce('x')).toBe(false);
        });

        it('expired entries are cleaned up', () => {
            isDuplicateAnnounce('ttl-test', 1); // 1ms TTL
            // Wait for expiry
            const start = Date.now();
            while (Date.now() - start < 5) {}
            expect(isDuplicateAnnounce('ttl-test')).toBe(false);
        });
    });
});
