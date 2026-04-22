import { describe, it, expect } from 'vitest';
import { resolveCronStyleNow, appendCronStyleCurrentTimeLine } from './current-time.js';

const NOW_MS = Date.parse('2025-06-15T14:30:00Z');

describe('resolveCronStyleNow', () => {
    it('returns userTimezone', () => {
        const result = resolveCronStyleNow({}, NOW_MS);
        expect(result.userTimezone).toBeTruthy();
    });

    it('returns formattedTime', () => {
        const result = resolveCronStyleNow({}, NOW_MS);
        expect(result.formattedTime).toBeTruthy();
        expect(result.formattedTime.length).toBeGreaterThan(5);
    });

    it('returns timeLine with UTC', () => {
        const result = resolveCronStyleNow({}, NOW_MS);
        expect(result.timeLine).toContain('Current time:');
        expect(result.timeLine).toContain('UTC');
    });

    it('uses configured timezone', () => {
        const result = resolveCronStyleNow({
            agents: { defaults: { userTimezone: 'America/New_York' } },
        }, NOW_MS);
        expect(result.userTimezone).toBe('America/New_York');
    });
});

describe('appendCronStyleCurrentTimeLine', () => {
    it('appends time line to text', () => {
        const result = appendCronStyleCurrentTimeLine('Hello world', {}, NOW_MS);
        expect(result).toContain('Hello world');
        expect(result).toContain('Current time:');
    });

    it('does not duplicate if already present', () => {
        const text = 'Hello\nCurrent time: already here';
        const result = appendCronStyleCurrentTimeLine(text, {}, NOW_MS);
        expect(result).toBe(text);
    });

    it('returns empty for empty text', () => {
        expect(appendCronStyleCurrentTimeLine('', {}, NOW_MS)).toBe('');
    });
});
