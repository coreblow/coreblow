import { describe, it, expect } from 'vitest';
import {
    isRouteBinding, isAcpBinding, listConfiguredBindings,
    listRouteBindings, listAcpBindings,
    resolveAgentForChannel, resolveChannelsForAgent,
} from './bindings.js';

describe('Agent-Channel Bindings', () => {
    const cfg = {
        bindings: [
            { type: 'route', agent: 'main', channel: 'discord' },
            { type: 'route', agent: 'main', channel: 'telegram' },
            { type: 'route', agent: 'support', channel: 'slack', accountId: 'team-1' },
            { type: 'acp', agent: 'autopilot', provider: 'openai' },
        ],
    };

    it('isRouteBinding', () => {
        expect(isRouteBinding({ type: 'route', agent: 'a', channel: 'b' })).toBe(true);
        expect(isRouteBinding({ type: 'acp', agent: 'a', provider: 'p' })).toBe(false);
    });

    it('isAcpBinding', () => {
        expect(isAcpBinding({ type: 'acp', agent: 'a', provider: 'p' })).toBe(true);
        expect(isAcpBinding({ type: 'route', agent: 'a', channel: 'b' })).toBe(false);
    });

    it('listConfiguredBindings', () => {
        expect(listConfiguredBindings(cfg)).toHaveLength(4);
    });

    it('listConfiguredBindings returns empty for no bindings', () => {
        expect(listConfiguredBindings({})).toHaveLength(0);
    });

    it('listRouteBindings', () => {
        expect(listRouteBindings(cfg)).toHaveLength(3);
    });

    it('listAcpBindings', () => {
        expect(listAcpBindings(cfg)).toHaveLength(1);
    });

    it('resolveAgentForChannel exact match', () => {
        expect(resolveAgentForChannel(cfg, 'slack', 'team-1')).toBe('support');
    });

    it('resolveAgentForChannel channel-only match', () => {
        expect(resolveAgentForChannel(cfg, 'discord')).toBe('main');
    });

    it('resolveAgentForChannel returns undefined for unbound', () => {
        expect(resolveAgentForChannel(cfg, 'whatsapp')).toBeUndefined();
    });

    it('resolveChannelsForAgent', () => {
        expect(resolveChannelsForAgent(cfg, 'main')).toEqual(['discord', 'telegram']);
    });

    it('resolveChannelsForAgent returns empty for unknown agent', () => {
        expect(resolveChannelsForAgent(cfg, 'unknown')).toEqual([]);
    });
});
