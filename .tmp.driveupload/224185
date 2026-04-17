/**
 * CoreBlow — Tool Profiles / Access Control Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { AccessControl } from './tool-profiles.js';
import type { AccessProfile, ToolProfile } from './tool-profiles.js';

describe('AccessControl', () => {
    let ac: AccessControl;

    beforeEach(() => {
        ac = new AccessControl();
    });

    // ─── canUseTool (AccessProfile) ──────────────────────────────

    describe('canUseTool', () => {
        it('full profile should allow exec', () => {
            expect(ac.canUseTool('full', 'exec')).toBe(true);
        });

        it('full profile should allow any tool', () => {
            expect(ac.canUseTool('full', 'some_random_tool')).toBe(true);
        });

        it('read-only should NOT allow exec', () => {
            expect(ac.canUseTool('read-only', 'exec')).toBe(false);
        });

        it('read-only should allow web_search', () => {
            expect(ac.canUseTool('read-only', 'web_search')).toBe(true);
        });

        it('read-only should allow session_status', () => {
            expect(ac.canUseTool('read-only', 'session_status')).toBe(true);
        });

        it('no-exec should NOT allow exec', () => {
            expect(ac.canUseTool('no-exec', 'exec')).toBe(false);
        });

        it('no-exec should NOT allow process', () => {
            expect(ac.canUseTool('no-exec', 'process')).toBe(false);
        });

        it('no-exec should allow web_search', () => {
            expect(ac.canUseTool('no-exec', 'web_search')).toBe(true);
        });
    });

    // ─── isToolAllowed (ToolProfile) ─────────────────────────────

    describe('isToolAllowed', () => {
        it('full profile should allow any tool', () => {
            const full = new AccessControl({ profile: 'full' });
            expect(full.isToolAllowed('exec')).toBe(true);
            expect(full.isToolAllowed('any_tool')).toBe(true);
        });

        it('minimal profile should only allow session_status', () => {
            const minimal = new AccessControl({ profile: 'minimal' });
            expect(minimal.isToolAllowed('session_status')).toBe(true);
            expect(minimal.isToolAllowed('exec')).toBe(false);
        });

        it('coding profile should allow exec (via group:fs)', () => {
            const coding = new AccessControl({ profile: 'coding' });
            expect(coding.isToolAllowed('exec')).toBe(true);
        });

        it('coding profile should allow web_search', () => {
            const coding = new AccessControl({ profile: 'coding' });
            expect(coding.isToolAllowed('web_search')).toBe(true);
        });

        it('messaging profile should allow message', () => {
            const msg = new AccessControl({ profile: 'messaging' });
            expect(msg.isToolAllowed('message')).toBe(true);
        });

        it('messaging profile should NOT allow exec', () => {
            const msg = new AccessControl({ profile: 'messaging' });
            expect(msg.isToolAllowed('exec')).toBe(false);
        });
    });

    // ─── Allow/Deny Overrides ────────────────────────────────────

    describe('allow/deny overrides', () => {
        it('allow should add tool to minimal profile', () => {
            const ac = new AccessControl({ profile: 'minimal', allow: ['web_search'] });
            expect(ac.isToolAllowed('web_search')).toBe(true);
        });

        it('deny should block tool even in full profile', () => {
            const ac = new AccessControl({ profile: 'full', deny: ['exec'] });
            expect(ac.isToolAllowed('exec')).toBe(false);
        });

        it('deny should override allow', () => {
            const ac = new AccessControl({ profile: 'minimal', allow: ['exec'], deny: ['exec'] });
            expect(ac.isToolAllowed('exec')).toBe(false);
        });
    });

    // ─── byProvider ──────────────────────────────────────────────

    describe('byProvider', () => {
        it('should use provider-specific profile', () => {
            const ac = new AccessControl({
                profile: 'full',
                byProvider: { 'openai': { profile: 'minimal' } },
            });
            expect(ac.isToolAllowed('exec', 'openai')).toBe(false);
            expect(ac.isToolAllowed('exec')).toBe(true);
        });

        it('getEffectiveProfile should return provider profile', () => {
            const ac = new AccessControl({
                profile: 'full',
                byProvider: { 'openai': { profile: 'coding' } },
            });
            expect(ac.getEffectiveProfile('openai')).toBe('coding');
            expect(ac.getEffectiveProfile()).toBe('full');
        });
    });

    // ─── getProfile ──────────────────────────────────────────────

    describe('getProfile', () => {
        it('should return ProfileRules for full', () => {
            const rules = ac.getProfile('full');
            expect(rules.canExec).toBe(true);
            expect(rules.allowedTools).toBe('all');
        });

        it('should return ProfileRules for read-only', () => {
            const rules = ac.getProfile('read-only');
            expect(rules.canExec).toBe(false);
            expect(rules.canWriteFiles).toBe(false);
        });
    });

    // ─── getAllowedTools ─────────────────────────────────────────

    describe('getAllowedTools', () => {
        it('full profile should return [*]', () => {
            expect(ac.getAllowedTools('full')).toEqual(['*']);
        });

        it('minimal profile should return [session_status]', () => {
            const tools = ac.getAllowedTools('minimal');
            expect(tools).toEqual(['session_status']);
        });

        it('coding profile should expand groups and deduplicate', () => {
            const tools = ac.getAllowedTools('coding');
            expect(tools).toContain('exec');
            expect(tools).toContain('web_search');
            expect(new Set(tools).size).toBe(tools.length); // deduped
        });
    });
});
