import { describe, it, expect } from 'vitest';
import { resolveTarget, normalizeChannelId, isValidTarget } from '../resolve-target';

describe('resolveTarget', () => {
  it('should resolve channel targets', async () => {
    const result = await resolveTarget('#general');
    expect(result.targetType).toBe('channel');
    expect(result.targetId).toBe('general');
  });

  it('should resolve user targets', async () => {
    const result = await resolveTarget('@user1');
    expect(result.targetType).toBe('user');
  });

  it('should normalize channel IDs', () => {
    expect(normalizeChannelId('My Channel!')).toBe('mychannel');
  });

  it('should validate targets', () => {
    expect(isValidTarget('valid')).toBe(true);
    expect(isValidTarget('')).toBe(false);
  });
});
