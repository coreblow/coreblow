/**
 * Layer 4: Tool Profiles + Access Profiles test suite
 */
import { describe, it, expect } from 'vitest';
import { AccessControl, type ToolProfile, type AccessProfile } from './tool-profiles.js';

describe('AccessControl', () => {
    describe('canUseTool (AccessProfile)', () => {
        const ac = new AccessControl();

        it('full profile allows everything', () => {
            expect(ac.canUseTool('full', 'exec')).toBe(true);
            expect(ac.canUseTool('full', 'browser')).toBe(true);
            expect(ac.canUseTool('full', 'message')).toBe(true);
        });

        it('read-only profile blocks exec', () => {
            expect(ac.canUseTool('read-only', 'exec')).toBe(false);
            expect(ac.canUseTool('read-only', 'process')).toBe(false);
            expect(ac.canUseTool('read-only', 'web_search')).toBe(true);
            expect(ac.canUseTool('read-only', 'image')).toBe(true);
        });

        it('no-exec profile blocks exec but allows others', () => {
            expect(ac.canUseTool('no-exec', 'exec')).toBe(false);
            expect(ac.canUseTool('no-exec', 'process')).toBe(false);
            expect(ac.canUseTool('no-exec', 'web_search')).toBe(true);
            expect(ac.canUseTool('no-exec', 'message')).toBe(true);
        });
    });

    describe('isToolAllowed (ToolProfile)', () => {
        it('minimal profile allows only session_status', () => {
            const ac = new AccessControl({ profile: 'minimal' });
            expect(ac.isToolAllowed('session_status')).toBe(true);
            expect(ac.isToolAllowed('exec')).toBe(false);
            expect(ac.isToolAllowed('web_search')).toBe(false);
        });

        it('coding profile allows dev tools', () => {
            const ac = new AccessControl({ profile: 'coding' });
            expect(ac.isToolAllowed('exec')).toBe(true);
            expect(ac.isToolAllowed('web_search')).toBe(true);
            expect(ac.isToolAllowed('browser')).toBe(true);
            expect(ac.isToolAllowed('message')).toBe(false);
        });

        it('messaging profile allows messaging tools', () => {
            const ac = new AccessControl({ profile: 'messaging' });
            expect(ac.isToolAllowed('message')).toBe(true);
            expect(ac.isToolAllowed('sessions_list')).toBe(true);
            expect(ac.isToolAllowed('exec')).toBe(false);
        });

        it('full profile allows everything', () => {
            const ac = new AccessControl({ profile: 'full' });
            expect(ac.isToolAllowed('exec')).toBe(true);
            expect(ac.isToolAllowed('message')).toBe(true);
            expect(ac.isToolAllowed('arbitrary_tool')).toBe(true);
        });
    });

    describe('allow/deny overrides', () => {
        it('allow adds tools beyond profile', () => {
            const ac = new AccessControl({ profile: 'minimal', allow: ['web_search'] });
            expect(ac.isToolAllowed('session_status')).toBe(true);
            expect(ac.isToolAllowed('web_search')).toBe(true);
            expect(ac.isToolAllowed('exec')).toBe(false);
        });

        it('deny removes tools from profile', () => {
            const ac = new AccessControl({ profile: 'full', deny: ['browser'] });
            expect(ac.isToolAllowed('exec')).toBe(true);
            expect(ac.isToolAllowed('browser')).toBe(false);
        });
    });

    describe('byProvider overrides', () => {
        const ac = new AccessControl({
            profile: 'full',
            byProvider: {
                ollama: { profile: 'minimal' },
                anthropic: { profile: 'full' },
            },
        });

        it('uses default profile when no provider specified', () => {
            expect(ac.isToolAllowed('exec')).toBe(true);
        });

        it('uses provider-specific profile', () => {
            expect(ac.isToolAllowed('exec', 'ollama')).toBe(false);
            expect(ac.isToolAllowed('session_status', 'ollama')).toBe(true);
            expect(ac.isToolAllowed('exec', 'anthropic')).toBe(true);
        });

        it('getEffectiveProfile returns correct profile', () => {
            expect(ac.getEffectiveProfile('ollama')).toBe('minimal');
            expect(ac.getEffectiveProfile('anthropic')).toBe('full');
            expect(ac.getEffectiveProfile('unknown')).toBe('full');
            expect(ac.getEffectiveProfile()).toBe('full');
        });
    });

    describe('getAllowedTools', () => {
        it('returns * for full profile', () => {
            const ac = new AccessControl({ profile: 'full' });
            expect(ac.getAllowedTools()).toEqual(['*']);
        });

        it('returns expanded tools for coding profile', () => {
            const ac = new AccessControl({ profile: 'coding' });
            const tools = ac.getAllowedTools();
            expect(tools).toContain('exec');
            expect(tools).toContain('web_search');
            expect(tools).toContain('browser');
        });
    });
});
