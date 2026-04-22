import { describe, it, expect } from 'vitest';
import {
    DEFAULT_GATEWAY_HTTP_TOOL_DENY,
    DANGEROUS_ACP_TOOL_NAMES,
    DANGEROUS_ACP_TOOLS,
} from './dangerous-tools.js';

describe('Dangerous Tools Constants', () => {
    describe('DEFAULT_GATEWAY_HTTP_TOOL_DENY', () => {
        it('should be a non-empty array', () => {
            expect(DEFAULT_GATEWAY_HTTP_TOOL_DENY.length).toBeGreaterThan(0);
        });

        it('should include sessions_spawn', () => {
            expect(DEFAULT_GATEWAY_HTTP_TOOL_DENY).toContain('sessions_spawn');
        });

        it('should include sessions_send', () => {
            expect(DEFAULT_GATEWAY_HTTP_TOOL_DENY).toContain('sessions_send');
        });

        it('should include cron', () => {
            expect(DEFAULT_GATEWAY_HTTP_TOOL_DENY).toContain('cron');
        });

        it('should include gateway', () => {
            expect(DEFAULT_GATEWAY_HTTP_TOOL_DENY).toContain('gateway');
        });

        it('should include whatsapp_login', () => {
            expect(DEFAULT_GATEWAY_HTTP_TOOL_DENY).toContain('whatsapp_login');
        });

        it('should have exactly 5 entries', () => {
            expect(DEFAULT_GATEWAY_HTTP_TOOL_DENY).toHaveLength(5);
        });
    });

    describe('DANGEROUS_ACP_TOOL_NAMES', () => {
        it('should be a non-empty array', () => {
            expect(DANGEROUS_ACP_TOOL_NAMES.length).toBeGreaterThan(0);
        });

        it('should include exec', () => {
            expect(DANGEROUS_ACP_TOOL_NAMES).toContain('exec');
        });

        it('should include spawn', () => {
            expect(DANGEROUS_ACP_TOOL_NAMES).toContain('spawn');
        });

        it('should include fs_write, fs_delete, fs_move', () => {
            expect(DANGEROUS_ACP_TOOL_NAMES).toContain('fs_write');
            expect(DANGEROUS_ACP_TOOL_NAMES).toContain('fs_delete');
            expect(DANGEROUS_ACP_TOOL_NAMES).toContain('fs_move');
        });

        it('should include apply_patch', () => {
            expect(DANGEROUS_ACP_TOOL_NAMES).toContain('apply_patch');
        });
    });

    describe('DANGEROUS_ACP_TOOLS (Set)', () => {
        it('should be a Set', () => {
            expect(DANGEROUS_ACP_TOOLS).toBeInstanceOf(Set);
        });

        it('should have same size as DANGEROUS_ACP_TOOL_NAMES', () => {
            expect(DANGEROUS_ACP_TOOLS.size).toBe(DANGEROUS_ACP_TOOL_NAMES.length);
        });

        it('should contain all entries from DANGEROUS_ACP_TOOL_NAMES', () => {
            for (const name of DANGEROUS_ACP_TOOL_NAMES) {
                expect(DANGEROUS_ACP_TOOLS.has(name)).toBe(true);
            }
        });

        it('should NOT contain safe tools', () => {
            expect(DANGEROUS_ACP_TOOLS.has('read')).toBe(false);
            expect(DANGEROUS_ACP_TOOLS.has('search')).toBe(false);
            expect(DANGEROUS_ACP_TOOLS.has('list')).toBe(false);
        });
    });
});
