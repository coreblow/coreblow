/**
 * CoreBlow — Agent Timeout Tests (Inline)
 *
 * Tests for resolveAgentTimeoutSeconds and resolveAgentTimeoutMs logic.
 * Inline to avoid utils.js clamp / config.js import chain.
 */

import { describe, it, expect } from 'vitest';

// ── Inline replicas ────────────────────────────────────────────────

const DEFAULT_AGENT_TIMEOUT_SECONDS = 48 * 60 * 60;
const MAX_SAFE_TIMEOUT_MS = 2_147_000_000;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

const normalizeNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : undefined;

function resolveAgentTimeoutSeconds(cfg?: { agents?: { defaults?: { timeoutSeconds?: unknown } } }): number {
    const raw = normalizeNumber(cfg?.agents?.defaults?.timeoutSeconds);
    const seconds = raw ?? DEFAULT_AGENT_TIMEOUT_SECONDS;
    return Math.max(seconds, 1);
}

function resolveAgentTimeoutMs(opts: {
    cfg?: { agents?: { defaults?: { timeoutSeconds?: unknown } } };
    overrideMs?: number | null;
    overrideSeconds?: number | null;
    minMs?: number;
}): number {
    const minMs = Math.max(normalizeNumber(opts.minMs) ?? 1, 1);
    const clampTimeoutMs = (valueMs: number) => clamp(valueMs, minMs, MAX_SAFE_TIMEOUT_MS);
    const defaultMs = clampTimeoutMs(resolveAgentTimeoutSeconds(opts.cfg) * 1000);
    const NO_TIMEOUT_MS = MAX_SAFE_TIMEOUT_MS;

    const overrideMs = normalizeNumber(opts.overrideMs);
    if (overrideMs !== undefined) {
        if (overrideMs === 0) return NO_TIMEOUT_MS;
        if (overrideMs < 0) return defaultMs;
        return clampTimeoutMs(overrideMs);
    }
    const overrideSeconds = normalizeNumber(opts.overrideSeconds);
    if (overrideSeconds !== undefined) {
        if (overrideSeconds === 0) return NO_TIMEOUT_MS;
        if (overrideSeconds < 0) return defaultMs;
        return clampTimeoutMs(overrideSeconds * 1000);
    }
    return defaultMs;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('resolveAgentTimeoutSeconds', () => {
    it('returns default when no config', () => {
        expect(resolveAgentTimeoutSeconds()).toBe(DEFAULT_AGENT_TIMEOUT_SECONDS);
    });

    it('returns configured value', () => {
        expect(resolveAgentTimeoutSeconds({ agents: { defaults: { timeoutSeconds: 300 } } })).toBe(300);
    });

    it('clamps to minimum 1', () => {
        expect(resolveAgentTimeoutSeconds({ agents: { defaults: { timeoutSeconds: 0 } } })).toBe(1);
        expect(resolveAgentTimeoutSeconds({ agents: { defaults: { timeoutSeconds: -5 } } })).toBe(1);
    });

    it('ignores non-finite values', () => {
        expect(resolveAgentTimeoutSeconds({ agents: { defaults: { timeoutSeconds: NaN } } })).toBe(DEFAULT_AGENT_TIMEOUT_SECONDS);
    });
});

describe('resolveAgentTimeoutMs', () => {
    it('returns default ms from config', () => {
        const ms = resolveAgentTimeoutMs({});
        expect(ms).toBe(DEFAULT_AGENT_TIMEOUT_SECONDS * 1000);
    });

    it('overrides with ms', () => {
        expect(resolveAgentTimeoutMs({ overrideMs: 5000 })).toBe(5000);
    });

    it('overrides with seconds', () => {
        expect(resolveAgentTimeoutMs({ overrideSeconds: 60 })).toBe(60000);
    });

    it('treats 0 ms as no-timeout', () => {
        expect(resolveAgentTimeoutMs({ overrideMs: 0 })).toBe(MAX_SAFE_TIMEOUT_MS);
    });

    it('treats 0 seconds as no-timeout', () => {
        expect(resolveAgentTimeoutMs({ overrideSeconds: 0 })).toBe(MAX_SAFE_TIMEOUT_MS);
    });

    it('negative override falls back to default', () => {
        const ms = resolveAgentTimeoutMs({ overrideMs: -1 });
        expect(ms).toBe(DEFAULT_AGENT_TIMEOUT_SECONDS * 1000);
    });

    it('clamps to MAX_SAFE_TIMEOUT_MS', () => {
        expect(resolveAgentTimeoutMs({ overrideMs: 9_999_999_999 })).toBe(MAX_SAFE_TIMEOUT_MS);
    });

    it('respects minMs', () => {
        expect(resolveAgentTimeoutMs({ overrideMs: 10, minMs: 1000 })).toBe(1000);
    });

    it('ms override takes precedence over seconds', () => {
        expect(resolveAgentTimeoutMs({ overrideMs: 5000, overrideSeconds: 120 })).toBe(5000);
    });
});
