import { describe, it, expect } from 'vitest';
import { formatBanner, pickTagline, hasJsonFlag, hasVersionFlag, hasQuietFlag, resetBannerState } from './banner.js';

describe('CLI Banner', () => {
    describe('pickTagline', () => {
        it('returns empty for off', () => expect(pickTagline('off')).toBe(''));
        it('returns first for default', () => expect(pickTagline('default')).toContain('Thinking'));
        it('returns non-empty for random', () => expect(pickTagline('random').length).toBeGreaterThan(0));
    });

    describe('formatBanner', () => {
        it('produces banner with COREBLOW', () => {
            const banner = formatBanner({ richTty: false });
            expect(banner).toContain('COREBLOW');
        });

        it('includes version', () => {
            const banner = formatBanner({ noColor: true });
            expect(banner).toMatch(/v\d+/);
        });

        it('includes commit suffix', () => {
            const banner = formatBanner({ commit: 'abc1234567890', noColor: true });
            expect(banner).toContain('abc1234');
        });

        it('suppresses tagline when off', () => {
            const banner = formatBanner({ taglineMode: 'off', noColor: true });
            expect(banner).not.toContain('🧠');
        });
    });

    describe('flag detection', () => {
        it('hasJsonFlag', () => {
            expect(hasJsonFlag(['--json'])).toBe(true);
            expect(hasJsonFlag(['--json=pretty'])).toBe(true);
            expect(hasJsonFlag(['--verbose'])).toBe(false);
        });

        it('hasVersionFlag', () => {
            expect(hasVersionFlag(['--version'])).toBe(true);
            expect(hasVersionFlag(['-V'])).toBe(true);
            expect(hasVersionFlag(['--help'])).toBe(false);
        });

        it('hasQuietFlag', () => {
            expect(hasQuietFlag(['--quiet'])).toBe(true);
            expect(hasQuietFlag(['-q'])).toBe(true);
            expect(hasQuietFlag(['--verbose'])).toBe(false);
        });
    });
});
