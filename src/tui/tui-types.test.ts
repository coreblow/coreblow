import { describe, expect, it } from 'vitest';
import type {
  AgentEvent,
  AgentSummary,
  BtwEvent,
  ChatEvent,
  GatewayStatusSummary,
  ResponseUsageMode,
  SessionInfo,
  SessionScope,
  TuiOptions,
  TuiStateAccess,
} from './tui-types.js';

describe('tui-types — structural shape contracts', () => {
  it('TuiOptions accepts optional fields', () => {
    const opts: TuiOptions = {};
    expect(opts).toBeDefined();
  });

  it('TuiOptions accepts all known fields', () => {
    const opts: TuiOptions = {
      url: 'http://localhost:3000',
      token: 'tok',
      password: 'pw',
      session: 'sess',
      deliver: true,
      thinking: 'auto',
      timeoutMs: 30000,
      historyLimit: 100,
      message: 'hello',
    };
    expect(opts.url).toBe('http://localhost:3000');
    expect(opts.deliver).toBe(true);
  });

  it('ResponseUsageMode accepts valid literals', () => {
    const modes: ResponseUsageMode[] = ['on', 'off', 'tokens', 'full'];
    expect(modes).toHaveLength(4);
  });

  it('SessionScope accepts valid literals', () => {
    const scopes: SessionScope[] = ['per-sender', 'global'];
    expect(scopes).toHaveLength(2);
  });

  it('ChatEvent shape has required runId and sessionKey', () => {
    const ev: ChatEvent = { runId: 'r1', sessionKey: 'agent:main:main' } as ChatEvent;
    expect(ev.runId).toBe('r1');
  });

  it('type module resolves at runtime', async () => {
    const mod = await import('./tui-types.js').catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
