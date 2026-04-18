/**
 * Tests for Wave 3 Gateway Modules:
 * Auth, Circuit Breaker, Concurrency, Health Check, Channel Health, HTTP Common
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─── Auth Tests ──────────────────────────────────────────────────

import {
    authenticate,
    maskApiKey,
    generateApiKey,
    hasPermission,
    createDefaultAuthConfig,
    clearRateLimits,
    type AuthConfig,
} from './auth.js';

describe('Gateway Auth', () => {
    beforeEach(() => clearRateLimits());

    const config: AuthConfig = {
        strategies: ['api-key', 'bearer'],
        apiKeys: [
            { key: 'sk-test-key-123', role: 'owner', label: 'test' },
            { key: 'sk-readonly-456', role: 'readonly' },
        ],
        bearerTokens: [
            { token: 'bearer-token-abc', role: 'user', userId: 'user-1' },
        ],
    };

    it('should authenticate with valid API key', () => {
        const result = authenticate({ headers: { 'x-api-key': 'sk-test-key-123' } }, config);
        expect(result.authenticated).toBe(true);
        expect(result.role).toBe('owner');
        expect(result.strategy).toBe('api-key');
    });

    it('should authenticate with Bearer token', () => {
        const result = authenticate({ headers: { authorization: 'Bearer bearer-token-abc' } }, config);
        expect(result.authenticated).toBe(true);
        expect(result.role).toBe('user');
        expect(result.userId).toBe('user-1');
    });

    it('should reject invalid API key', () => {
        const result = authenticate({ headers: { 'x-api-key': 'invalid' } }, config);
        expect(result.authenticated).toBe(false);
    });

    it('should reject no credentials', () => {
        const result = authenticate({ headers: {} }, config);
        expect(result.authenticated).toBe(false);
    });

    it('should allow anonymous when configured', () => {
        const anonConfig: AuthConfig = { strategies: ['api-key'], allowAnonymous: true };
        const result = authenticate({ headers: {} }, anonConfig);
        expect(result.authenticated).toBe(true);
        expect(result.role).toBe('anonymous');
    });

    it('should reject expired API keys', () => {
        const expiredConfig: AuthConfig = {
            strategies: ['api-key'],
            apiKeys: [{ key: 'exp-key', role: 'user', expiresAt: Date.now() - 1000 }],
        };
        const result = authenticate({ headers: { 'x-api-key': 'exp-key' } }, expiredConfig);
        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('api_key_expired');
    });

    it('should enforce rate limits', () => {
        const rlConfig: AuthConfig = {
            strategies: ['api-key'],
            apiKeys: [{ key: 'rl-key', role: 'user' }],
            rateLimitPerKey: 3,
        };
        for (let i = 0; i < 3; i++) {
            expect(authenticate({ headers: { 'x-api-key': 'rl-key' } }, rlConfig).authenticated).toBe(true);
        }
        expect(authenticate({ headers: { 'x-api-key': 'rl-key' } }, rlConfig).error).toBe('rate_limit_exceeded');
    });

    it('should mask API keys', () => {
        expect(maskApiKey('sk-test-key-12345678')).toBe('sk-t...5678');
        expect(maskApiKey('short')).toBe('****');
    });

    it('should generate API keys', () => {
        const key = generateApiKey('cb');
        expect(key.startsWith('cb_')).toBe(true);
        expect(key.length).toBeGreaterThan(10);
    });

    it('should check permissions', () => {
        expect(hasPermission('owner', 'user')).toBe(true);
        expect(hasPermission('user', 'owner')).toBe(false);
        expect(hasPermission('admin', 'admin')).toBe(true);
        expect(hasPermission('anonymous', 'readonly')).toBe(false);
    });

    it('should create default auth config', () => {
        const withKey = createDefaultAuthConfig('sk-key');
        expect(withKey.strategies).toContain('api-key');
        const noKey = createDefaultAuthConfig();
        expect(noKey.allowAnonymous).toBe(true);
    });
});

// ─── Circuit Breaker Tests ───────────────────────────────────────

import {
    CircuitBreaker,
    CircuitOpenError,
    getCircuitBreaker,
    listCircuitBreakers,
    clearCircuitBreakers,
} from './circuit-breaker.js';

describe('CircuitBreaker', () => {
    beforeEach(() => clearCircuitBreakers());

    it('should start closed', () => {
        const cb = new CircuitBreaker('test', { threshold: 3 });
        expect(cb.getState()).toBe('closed');
        expect(cb.getStats().healthScore).toBe(1);
    });

    it('should execute successfully', async () => {
        const cb = new CircuitBreaker('test');
        const result = await cb.execute(async () => 42);
        expect(result).toBe(42);
    });

    it('should open after threshold failures', async () => {
        const cb = new CircuitBreaker('test', { threshold: 2, slidingWindowMs: 60000 });
        for (let i = 0; i < 2; i++) {
            try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
        }
        expect(cb.getState()).toBe('open');
    });

    it('should reject when open', async () => {
        const cb = new CircuitBreaker('test', { threshold: 1 });
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
        await expect(cb.execute(async () => 1)).rejects.toThrow(CircuitOpenError);
    });

    it('should transition to half-open after reset time', async () => {
        const cb = new CircuitBreaker('test', { threshold: 1, resetMs: 1 });
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
        const start = Date.now();
        while (Date.now() - start < 10) { /* */ }
        expect(cb.canExecute()).toBe(true);
        expect(cb.getState()).toBe('half-open');
    });

    it('should close after consecutive successes in half-open', async () => {
        const cb = new CircuitBreaker('test', { threshold: 1, resetMs: 1, consecutiveSuccessesToClose: 2 });
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
        const start = Date.now();
        while (Date.now() - start < 10) { /* */ }
        await cb.execute(async () => 1);
        await cb.execute(async () => 2);
        expect(cb.getState()).toBe('closed');
    });

    it('should emit state changes', async () => {
        const cb = new CircuitBreaker('test', { threshold: 1 });
        const changes: string[] = [];
        cb.on('stateChange', (e) => changes.push(e.to));
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
        expect(changes).toContain('open');
    });

    it('should track stats', async () => {
        const cb = new CircuitBreaker('test');
        await cb.execute(async () => 1);
        const stats = cb.getStats();
        expect(stats.totalCalls).toBe(1);
        expect(stats.successes).toBe(1);
    });

    it('should support registry', () => {
        const cb1 = getCircuitBreaker('service-a');
        const cb2 = getCircuitBreaker('service-b');
        expect(listCircuitBreakers()).toHaveLength(2);
    });

    it('should support reset', async () => {
        const cb = new CircuitBreaker('test', { threshold: 1 });
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch {}
        cb.reset();
        expect(cb.getState()).toBe('closed');
    });
});

// ─── Concurrency Tests ───────────────────────────────────────────

import { ConcurrencyLimiter, getKeyLimiter, clearKeyLimiters } from './concurrency.js';

describe('ConcurrencyLimiter', () => {
    beforeEach(() => clearKeyLimiters());

    it('should allow up to max concurrent', async () => {
        const limiter = new ConcurrencyLimiter(2);
        await limiter.acquire();
        await limiter.acquire();
        expect(limiter.getActive()).toBe(2);
        limiter.release();
        limiter.release();
    });

    it('should queue beyond max', async () => {
        const limiter = new ConcurrencyLimiter(1);
        await limiter.acquire();
        const p = limiter.acquire(0, 1000);
        expect(limiter.getQueued()).toBe(1);
        limiter.release();
        await p;
    });

    it('should support priority ordering', async () => {
        const limiter = new ConcurrencyLimiter(1);
        const order: number[] = [];
        await limiter.acquire();

        const p1 = limiter.acquire(1).then(() => { order.push(1); limiter.release(); });
        const p2 = limiter.acquire(10).then(() => { order.push(10); limiter.release(); }); // higher priority
        limiter.release();
        await Promise.all([p1, p2]);
        expect(order[0]).toBe(10); // Higher priority first
    });

    it('should support withLimit helper', async () => {
        const limiter = new ConcurrencyLimiter(2);
        const result = await limiter.withLimit(async () => 42);
        expect(result).toBe(42);
        expect(limiter.getActive()).toBe(0);
    });

    it('should timeout acquire', async () => {
        const limiter = new ConcurrencyLimiter(1, 50);
        await limiter.acquire();
        await expect(limiter.acquire(0, 10)).rejects.toThrow('timeout');
        limiter.release();
    });

    it('should track stats', async () => {
        const limiter = new ConcurrencyLimiter(5);
        await limiter.acquire();
        const stats = limiter.getStats();
        expect(stats.totalAcquired).toBe(1);
        expect(stats.active).toBe(1);
        limiter.release();
    });

    it('should support per-key limiters', () => {
        const l1 = getKeyLimiter('user-1', 3);
        const l2 = getKeyLimiter('user-2', 5);
        expect(l1.getMax()).toBe(3);
        expect(l2.getMax()).toBe(5);
    });
});

// ─── Health Check Tests ──────────────────────────────────────────

import {
    checkHealth,
    checkLiveness,
    checkReadiness,
    registerProbe,
    clearProbes,
    createMemoryProbe,
    createUptimeProbe,
    createEventLoopProbe,
} from './health-check.js';

describe('Health Check', () => {
    beforeEach(() => clearProbes());

    it('should return healthy with no probes', async () => {
        const result = await checkHealth();
        expect(result.status).toBe('healthy');
        expect(result.uptime).toBeGreaterThan(0);
    });

    it('should run registered probes', async () => {
        registerProbe('test', async () => ({ status: 'healthy', message: 'OK', lastChecked: Date.now() }));
        const result = await checkHealth();
        expect(result.checks.test).toBeDefined();
        expect(result.checks.test!.status).toBe('healthy');
    });

    it('should report degraded status', async () => {
        registerProbe('slow', async () => ({ status: 'degraded', message: 'Slow', lastChecked: Date.now() }));
        const result = await checkHealth();
        expect(result.status).toBe('degraded');
    });

    it('should report unhealthy on probe failure', async () => {
        registerProbe('broken', async () => { throw new Error('Connection refused'); });
        const result = await checkHealth();
        expect(result.status).toBe('unhealthy');
        expect(result.checks.broken!.message).toContain('Connection refused');
    });

    it('should report liveness', async () => {
        const { alive } = await checkLiveness();
        expect(alive).toBe(true);
    });

    it('should report readiness', async () => {
        const { ready } = await checkReadiness();
        expect(ready).toBe(true);
    });

    it('should support memory probe', async () => {
        registerProbe('memory', createMemoryProbe(2048));
        const result = await checkHealth();
        expect(result.checks.memory!.status).toBe('healthy');
    });

    it('should support uptime probe', async () => {
        registerProbe('uptime', createUptimeProbe(0));
        const result = await checkHealth();
        expect(result.checks.uptime!.status).toBe('healthy');
    });

    it('should support event loop probe', async () => {
        registerProbe('eventloop', createEventLoopProbe(5000));
        const result = await checkHealth();
        expect(result.checks.eventloop!.status).toBe('healthy');
    });
});

// ─── Channel Health Tests ─────────────────────────────────────────

import { ChannelHealthMonitor } from './channel-health.js';

describe('ChannelHealthMonitor', () => {
    it('should register channels', () => {
        const monitor = new ChannelHealthMonitor();
        monitor.register('telegram');
        monitor.register('discord');
        expect(monitor.getAllStatuses()).toHaveLength(2);
    });

    it('should record heartbeats', () => {
        const monitor = new ChannelHealthMonitor();
        monitor.register('telegram');
        monitor.recordHeartbeat('telegram', 50);
        const status = monitor.getStatus('telegram');
        expect(status!.status).toBe('connected');
        expect(status!.latencyMs).toBe(50);
    });

    it('should track errors', () => {
        const monitor = new ChannelHealthMonitor({ maxConsecutiveErrors: 2 });
        monitor.register('telegram');
        monitor.recordError('telegram', 'Timeout');
        expect(monitor.getStatus('telegram')!.status).toBe('degraded');
        monitor.recordError('telegram', 'Timeout');
        expect(monitor.getStatus('telegram')!.status).toBe('disconnected');
    });

    it('should recover on heartbeat', () => {
        const monitor = new ChannelHealthMonitor({ maxConsecutiveErrors: 1 });
        monitor.register('telegram');
        monitor.recordError('telegram', 'Error');
        expect(monitor.getStatus('telegram')!.status).toBe('disconnected');
        monitor.recordHeartbeat('telegram');
        expect(monitor.getStatus('telegram')!.status).toBe('connected');
    });

    it('should emit events', () => {
        const monitor = new ChannelHealthMonitor({ maxConsecutiveErrors: 1 });
        const events: string[] = [];
        monitor.on('disconnected', () => events.push('disconnected'));
        monitor.on('recovered', () => events.push('recovered'));
        monitor.register('telegram');
        monitor.recordError('telegram', 'Error');
        monitor.recordHeartbeat('telegram');
        expect(events).toContain('disconnected');
        expect(events).toContain('recovered');
    });

    it('should summarize health', () => {
        const monitor = new ChannelHealthMonitor({ maxConsecutiveErrors: 1 });
        monitor.register('tg');
        monitor.register('dc');
        monitor.recordHeartbeat('tg');
        monitor.recordError('dc', 'err');
        const summary = monitor.getHealthySummary();
        expect(summary.healthy).toBe(1);
        expect(summary.disconnected).toBe(1);
    });

    it('should cleanup', () => {
        const monitor = new ChannelHealthMonitor();
        monitor.register('test');
        monitor.remove('test');
        expect(monitor.getAllStatuses()).toHaveLength(0);
    });
});

// ─── HTTP Common Tests ───────────────────────────────────────────

import {
    HTTP_STATUS,
    buildCorsHeaders,
    negotiateContentType,
    contentTypeHeader,
    parseQueryString,
    extractBearerToken,
    getClientIp,
    successResponse,
    errorResponse,
    formatSSEEvent,
} from './http-common.js';

describe('HTTP Common', () => {
    it('should have standard status codes', () => {
        expect(HTTP_STATUS.OK).toBe(200);
        expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
        expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
    });

    it('should build CORS headers', () => {
        const headers = buildCorsHeaders('https://example.com', { origins: ['https://example.com'] });
        expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
    });

    it('should reject unallowed origins', () => {
        const headers = buildCorsHeaders('https://evil.com', { origins: ['https://good.com'] });
        expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should support wildcard CORS', () => {
        const headers = buildCorsHeaders('https://anything.com', { origins: ['*'] });
        expect(headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should negotiate content type', () => {
        expect(negotiateContentType('text/event-stream')).toBe('sse');
        expect(negotiateContentType('application/json')).toBe('json');
        expect(negotiateContentType('text/html')).toBe('html');
        expect(negotiateContentType()).toBe('json');
    });

    it('should return content type headers', () => {
        expect(contentTypeHeader('json')).toContain('application/json');
        expect(contentTypeHeader('sse')).toContain('text/event-stream');
    });

    it('should parse query strings', () => {
        expect(parseQueryString('/path?a=1&b=hello')).toEqual({ a: '1', b: 'hello' });
        expect(parseQueryString('/path')).toEqual({});
    });

    it('should extract bearer tokens', () => {
        expect(extractBearerToken('Bearer abc123')).toBe('abc123');
        expect(extractBearerToken('Basic xyz')).toBeNull();
        expect(extractBearerToken(undefined)).toBeNull();
    });

    it('should get client IP', () => {
        expect(getClientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })).toBe('1.2.3.4');
        expect(getClientIp({ 'x-real-ip': '10.0.0.1' })).toBe('10.0.0.1');
        expect(getClientIp({}, '127.0.0.1')).toBe('127.0.0.1');
    });

    it('should build success/error responses', () => {
        const ok = successResponse({ id: 1 });
        expect(ok.ok).toBe(true);
        expect(ok.data).toEqual({ id: 1 });

        const err = errorResponse('NOT_FOUND', 'User not found');
        expect(err.ok).toBe(false);
        expect(err.error!.code).toBe('NOT_FOUND');
    });

    it('should format SSE events', () => {
        const sse = formatSSEEvent({ text: 'hello' }, 'message', '1');
        expect(sse).toContain('id: 1');
        expect(sse).toContain('event: message');
        expect(sse).toContain('data: ');
    });
});
