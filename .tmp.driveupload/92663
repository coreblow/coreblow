/**
 * auto-reply/mention.test.ts — Group activation & mention gating tests
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeGroupActivation, parseActivationCommand,
    shouldActivateInGroup, resolveGroupActivationMode,
} from './group-activation.js';

describe('Group Activation', () => {
    describe('normalizeGroupActivation', () => {
        it('normalizes mention', () => expect(normalizeGroupActivation('mention')).toBe('mention'));
        it('normalizes MENTION', () => expect(normalizeGroupActivation('MENTION')).toBe('mention'));
        it('normalizes always', () => expect(normalizeGroupActivation('always')).toBe('always'));
        it('returns undefined for unknown', () => expect(normalizeGroupActivation('unknown')).toBeUndefined());
        it('returns undefined for null', () => expect(normalizeGroupActivation(null)).toBeUndefined());
        it('returns undefined for empty', () => expect(normalizeGroupActivation('')).toBeUndefined());
    });

    describe('parseActivationCommand', () => {
        it('parses /activation mention', () => {
            const result = parseActivationCommand('/activation mention');
            expect(result.hasCommand).toBe(true);
            expect(result.mode).toBe('mention');
        });

        it('parses /activation always', () => {
            const result = parseActivationCommand('/activation always');
            expect(result.hasCommand).toBe(true);
            expect(result.mode).toBe('always');
        });

        it('parses /activation without mode', () => {
            const result = parseActivationCommand('/activation');
            expect(result.hasCommand).toBe(true);
            expect(result.mode).toBeUndefined();
        });

        it('rejects non-activation commands', () => {
            expect(parseActivationCommand('/help').hasCommand).toBe(false);
            expect(parseActivationCommand('just text').hasCommand).toBe(false);
            expect(parseActivationCommand('').hasCommand).toBe(false);
            expect(parseActivationCommand(undefined).hasCommand).toBe(false);
        });
    });

    describe('shouldActivateInGroup', () => {
        it('always activates in DM', () => {
            expect(shouldActivateInGroup({ mode: 'mention', isMentioned: false, isReplyToBot: false, isDirectMessage: true })).toBe(true);
        });

        it('activates in always mode regardless', () => {
            expect(shouldActivateInGroup({ mode: 'always', isMentioned: false, isReplyToBot: false, isDirectMessage: false })).toBe(true);
        });

        it('activates on mention in mention mode', () => {
            expect(shouldActivateInGroup({ mode: 'mention', isMentioned: true, isReplyToBot: false, isDirectMessage: false })).toBe(true);
        });

        it('activates on reply to bot in mention mode', () => {
            expect(shouldActivateInGroup({ mode: 'mention', isMentioned: false, isReplyToBot: true, isDirectMessage: false })).toBe(true);
        });

        it('does not activate without mention in mention mode', () => {
            expect(shouldActivateInGroup({ mode: 'mention', isMentioned: false, isReplyToBot: false, isDirectMessage: false })).toBe(false);
        });
    });

    describe('resolveGroupActivationMode', () => {
        it('defaults to mention', () => {
            expect(resolveGroupActivationMode({})).toBe('mention');
        });

        it('uses global default', () => {
            expect(resolveGroupActivationMode({ agents: { defaults: { groupActivation: 'always' } } })).toBe('always');
        });

        it('uses channel override', () => {
            const cfg = {
                agents: { defaults: { groupActivation: 'always' } },
                channels: { discord: { groupActivation: 'mention' } },
            };
            expect(resolveGroupActivationMode(cfg, 'discord')).toBe('mention');
        });
    });
});
