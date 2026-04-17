/**
 * CoreBlow Phase 35 — ScheduleParser & ChannelDirectory Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - ScheduleParser: presets, every N, daily at, raw cron, invalid input
 *   - ChannelDirectory: registerProvider, resolveTargets, searchContacts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { parseSchedule, listPresets } from '../../src/cron/schedule-parse.js';
import {
    registerDirectoryProvider, getDirectoryProvider, resolveTargets,
    type DirectoryProvider,
} from '../../src/channels/directory.js';

// ================================================================
describe('ScheduleParser — Extended', () => {
    it('should list all presets', () => {
        const presets = listPresets();
        expect(presets.length).toBeGreaterThan(10);
        expect(presets[0]?.label).toBe('every minute');
    });

    it('should parse preset "every 5 minutes"', () => {
        const result = parseSchedule('every 5 minutes');
        expect(result).not.toBeNull();
        expect(result?.cronExpr).toBe('*/5 * * * *');
    });

    it('should parse "every hour"', () => {
        const result = parseSchedule('every hour');
        expect(result?.cronExpr).toBe('0 * * * *');
    });

    it('should parse "every N minutes" dynamically', () => {
        const result = parseSchedule('every 7 minutes');
        expect(result?.cronExpr).toBe('*/7 * * * *');
    });

    it('should parse "every N hours"', () => {
        const result = parseSchedule('every 3 hours');
        expect(result?.cronExpr).toBe('0 */3 * * *');
    });

    it('should parse "every N days"', () => {
        const result = parseSchedule('every 2 days');
        expect(result?.cronExpr).toBe('0 0 */2 * *');
    });

    it('should parse "daily at H:MM"', () => {
        const result = parseSchedule('daily at 14:30');
        expect(result?.cronExpr).toBe('30 14 * * *');
    });

    it('should parse "daily at H:MM pm"', () => {
        const result = parseSchedule('daily at 3:00 pm');
        expect(result?.cronExpr).toBe('0 15 * * *');
    });

    it('should parse "daily at 12:00 am" as midnight', () => {
        const result = parseSchedule('daily at 12:00 am');
        expect(result?.cronExpr).toBe('0 0 * * *');
    });

    it('should parse raw cron expression', () => {
        const result = parseSchedule('30 4 * * 1');
        expect(result?.cronExpr).toBe('30 4 * * 1');
        expect(result?.humanReadable).toContain('cron');
    });

    it('should return null for invalid input', () => {
        expect(parseSchedule('')).toBeNull();
        expect(parseSchedule('banana')).toBeNull();
        expect(parseSchedule('every 0 minutes')).toBeNull();
    });

    it('should handle case insensitivity', () => {
        expect(parseSchedule('Every 5 Minutes')).not.toBeNull();
        expect(parseSchedule('DAILY AT 9:00 AM')).not.toBeNull();
    });
});

// ================================================================
describe('ChannelDirectory — Extended', () => {
    it('should register and retrieve a directory provider', () => {
        const provider: DirectoryProvider = {
            listPeers: async () => [{ id: 'u1', kind: 'user', name: 'Alice' }],
        };
        registerDirectoryProvider('telegram', 'bot-1', provider);
        expect(getDirectoryProvider('telegram', 'bot-1')).toBe(provider);
    });

    it('should return null for unregistered provider', () => {
        expect(getDirectoryProvider('discord', 'unknown')).toBeNull();
    });

    it('should resolve targets with provider resolver', async () => {
        const provider: DirectoryProvider = {
            resolveTargets: async (inputs) => inputs.map(input => ({
                input, resolved: true, id: `resolved-${input}`, name: input,
            })),
        };
        registerDirectoryProvider('slack', 'workspace-1', provider);

        const results = await resolveTargets('slack', 'workspace-1', ['alice', 'bob']);
        expect(results).toHaveLength(2);
        expect(results[0]?.resolved).toBe(true);
        expect(results[0]?.id).toBe('resolved-alice');
    });

    it('should fallback to passthrough when no resolver', async () => {
        // Use a channel without resolveTargets
        registerDirectoryProvider('discord', 'fallback-test', {});

        const results = await resolveTargets('discord', 'fallback-test', ['user-123']);
        expect(results).toHaveLength(1);
        expect(results[0]?.resolved).toBe(true);
        expect(results[0]?.id).toBe('user-123');
        expect(results[0]?.note).toContain('passthrough');
    });
});
