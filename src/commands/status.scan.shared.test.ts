/**
 * commands/status.scan.shared.test.ts — Status scan shared tests
 */
import { describe, it, expect } from 'vitest';
import { aggregateStatus, formatScanResults } from './status.scan.shared.js';

describe('Status Scan Shared', () => {
    it('should aggregate healthy', () => {
        expect(aggregateStatus([
            { name: 'a', status: 'healthy' },
            { name: 'b', status: 'healthy' },
        ])).toBe('healthy');
    });

    it('should detect unhealthy', () => {
        expect(aggregateStatus([
            { name: 'a', status: 'healthy' },
            { name: 'b', status: 'unhealthy' },
        ])).toBe('unhealthy');
    });

    it('should detect degraded', () => {
        expect(aggregateStatus([
            { name: 'a', status: 'healthy' },
            { name: 'b', status: 'degraded' },
        ])).toBe('degraded');
    });

    it('should handle empty', () => {
        expect(aggregateStatus([])).toBe('unknown');
    });

    it('should format results', () => {
        const output = formatScanResults([
            { name: 'API', status: 'healthy', latencyMs: 50 },
            { name: 'DB', status: 'unhealthy', error: 'timeout' },
        ]);
        expect(output).toContain('✅');
        expect(output).toContain('❌');
        expect(output).toContain('50ms');
    });
});
