/**
 * CoreBlow — Canvas Capability Tests
 *
 * Tests for capability token minting, scoped URL building,
 * and URL normalization/parsing.
 */

import { describe, it, expect } from 'vitest';
import {
    CANVAS_CAPABILITY_PATH_PREFIX,
    CANVAS_CAPABILITY_QUERY_PARAM,
    CANVAS_CAPABILITY_TTL_MS,
    mintCanvasCapabilityToken,
    buildCanvasScopedHostUrl,
    normalizeCanvasScopedUrl,
} from './canvas-capability.js';

describe('constants', () => {
    it('has expected path prefix', () => {
        expect(CANVAS_CAPABILITY_PATH_PREFIX).toBe('/__coreblow__/cap');
    });

    it('has expected query param', () => {
        expect(CANVAS_CAPABILITY_QUERY_PARAM).toBe('oc_cap');
    });

    it('has 10 minute TTL', () => {
        expect(CANVAS_CAPABILITY_TTL_MS).toBe(600_000);
    });
});

describe('mintCanvasCapabilityToken', () => {
    it('returns a non-empty string', () => {
        const token = mintCanvasCapabilityToken();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
    });

    it('returns unique tokens', () => {
        const a = mintCanvasCapabilityToken();
        const b = mintCanvasCapabilityToken();
        expect(a).not.toBe(b);
    });

    it('returns base64url-safe characters', () => {
        const token = mintCanvasCapabilityToken();
        expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
    });
});

describe('buildCanvasScopedHostUrl', () => {
    it('builds a scoped URL with capability in path', () => {
        const url = buildCanvasScopedHostUrl('http://localhost:3000', 'my-cap-token');
        expect(url).toContain('/__coreblow__/cap/my-cap-token');
        expect(url?.startsWith('http://localhost:3000')).toBe(true);
    });

    it('strips trailing slashes from base path', () => {
        const url = buildCanvasScopedHostUrl('http://localhost:3000/', 'tok');
        expect(url?.endsWith('//')).toBe(false);
    });

    it('URL-encodes the capability token', () => {
        const url = buildCanvasScopedHostUrl('http://localhost:3000', 'a b+c');
        expect(url).toContain('a%20b%2Bc');
    });

    it('returns undefined for empty capability', () => {
        expect(buildCanvasScopedHostUrl('http://localhost:3000', '')).toBeUndefined();
        expect(buildCanvasScopedHostUrl('http://localhost:3000', '  ')).toBeUndefined();
    });

    it('strips query and hash from base URL', () => {
        const url = buildCanvasScopedHostUrl('http://localhost:3000?x=1#anchor', 'tok');
        expect(url).not.toContain('?x=1');
        expect(url).not.toContain('#anchor');
    });
});

describe('normalizeCanvasScopedUrl', () => {
    it('parses capability from scoped path', () => {
        const result = normalizeCanvasScopedUrl(
            '/__coreblow__/cap/my-token/api/chat'
        );
        expect(result.scopedPath).toBe(true);
        expect(result.capability).toBe('my-token');
        expect(result.pathname).toBe('/api/chat');
        expect(result.malformedScopedPath).toBe(false);
    });

    it('sets rewrittenUrl with query param', () => {
        const result = normalizeCanvasScopedUrl(
            '/__coreblow__/cap/tok123/some/path'
        );
        expect(result.rewrittenUrl).toContain('/some/path');
        expect(result.rewrittenUrl).toContain('oc_cap=tok123');
    });

    it('extracts capability from query param', () => {
        const result = normalizeCanvasScopedUrl('/api/chat?oc_cap=query-token');
        expect(result.capability).toBe('query-token');
        expect(result.scopedPath).toBe(false);
    });

    it('detects malformed scoped path (no trailing slash)', () => {
        const result = normalizeCanvasScopedUrl('/__coreblow__/cap/tok');
        expect(result.scopedPath).toBe(true);
        expect(result.malformedScopedPath).toBe(true);
    });

    it('handles non-scoped URLs', () => {
        const result = normalizeCanvasScopedUrl('/api/health');
        expect(result.scopedPath).toBe(false);
        expect(result.capability).toBeUndefined();
        expect(result.pathname).toBe('/api/health');
    });

    it('handles URL-encoded capability', () => {
        const result = normalizeCanvasScopedUrl(
            '/__coreblow__/cap/a%20b/path'
        );
        expect(result.capability).toBe('a b');
    });
});
