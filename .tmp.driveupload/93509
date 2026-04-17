/**
 * CoreBlow Infra Utilities — Tests
 */
import { describe, it, expect } from 'vitest';
import { isPortAvailable, findAvailablePort, resolvePort, checkPorts, DEFAULT_PORTS } from '../../src/infra/port-finder.js';
import { installWarningFilter, getSuppressedCount, addFilter } from '../../src/infra/warning-filter.js';
import { RestartSentinel } from '../../src/infra/restart-sentinel.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

// ================================================================
// Port Finder Tests
// ================================================================
describe('Port Finder', () => {
    it('should have default ports defined', () => {
        expect(DEFAULT_PORTS.gateway).toBe(3000);
        expect(DEFAULT_PORTS.dashboard).toBe(3001);
        expect(DEFAULT_PORTS.websocket).toBe(3002);
    });

    it('should find an available port', async () => {
        const port = await findAvailablePort(49152); // High port range
        expect(port).toBeGreaterThanOrEqual(49152);
    });

    it('should check port availability', async () => {
        const available = await isPortAvailable(49999);
        expect(typeof available).toBe('boolean');
    });

    it('should check multiple ports', async () => {
        const results = await checkPorts([49100, 49101, 49102]);
        expect(Object.keys(results)).toHaveLength(3);
    });

    it('should resolve a service port', async () => {
        const port = await resolvePort('gateway', 49200);
        expect(port).toBeGreaterThanOrEqual(49200);
    });
});

// ================================================================
// Warning Filter Tests
// ================================================================
describe('Warning Filter', () => {
    it('should install without error', () => {
        installWarningFilter();
        // Multiple installs should be idempotent
        installWarningFilter();
    });

    it('should track suppressed count', () => {
        const count = getSuppressedCount();
        expect(typeof count).toBe('number');
    });

    it('should accept custom filters', () => {
        addFilter({ type: 'CustomWarning', silent: true });
        // No crash = success
    });
});

// ================================================================
// Restart Sentinel Tests
// ================================================================
describe('Restart Sentinel', () => {
    const sentinelPath = path.join(os.tmpdir(), `cb-test-sentinel-${Date.now()}`);

    it('should create sentinel file on start', () => {
        const sentinel = new RestartSentinel({ sentinelPath });
        sentinel.start();

        expect(fs.existsSync(sentinelPath)).toBe(true);

        sentinel.stop();
    });

    it('should track state correctly', () => {
        const sentinel = new RestartSentinel({ sentinelPath });
        sentinel.start();

        const state = sentinel.getState();
        expect(state.active).toBe(true);
        expect(state.restartCount).toBe(0);

        sentinel.stop();
        expect(sentinel.getState().active).toBe(false);
    });

    it('should trigger restart by touching sentinel file', () => {
        const sentinel = new RestartSentinel({
            sentinelPath,
            pollIntervalMs: 50,
        });
        let restarted = false;
        sentinel.onRestart(() => { restarted = true; });
        sentinel.start();

        // Touch the file
        sentinel.triggerRestart();

        sentinel.stop();
    });

    it('should calculate backoff delays', () => {
        const sentinel = new RestartSentinel({
            sentinelPath,
            backoffBaseMs: 100,
            backoffMaxMs: 5000,
        });

        const delay = sentinel.getBackoffDelay();
        expect(delay).toBeGreaterThanOrEqual(100);
        expect(delay).toBeLessThanOrEqual(5500); // base + jitter
    });

    // Cleanup
    it('cleanup sentinel file', () => {
        if (fs.existsSync(sentinelPath)) {
            fs.unlinkSync(sentinelPath);
        }
    });
});
