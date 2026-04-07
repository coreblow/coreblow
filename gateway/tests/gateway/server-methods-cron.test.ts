import { describe, it, expect, vi } from 'vitest';
import { cronHandlers } from '../../src/gateway/server-methods/cron.js';

describe('Gateway Cron RPC', () => {
    it('should validate cron.add params and call service', async () => {
        let responded = false;
        const mockCron = {
            add: vi.fn().mockResolvedValue({ id: 'test-job-id', name: 'test' })
        };
        const context = {
            cron: mockCron,
            logGateway: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
            cronStorePath: '/tmp/cron'
        };

        await cronHandlers['cron.add']({
            req: { id: '1', method: 'cron.add' },
            params: {
                name: 'test-job',
                agentId: 'agent1',
                schedule: { kind: 'interval', seconds: 60 },
                sessionTarget: 'isolated'
            },
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload, err) => {
                expect(ok).toBe(true);
                expect(payload).toHaveProperty('id', 'test-job-id');
                responded = true;
            },
            context: context as any
        });

        expect(responded).toBe(true);
        expect(mockCron.add).toHaveBeenCalled();
    });

    it('should reject cron.add with invalid schedule timestamp', async () => {
        let responded = false;
        await cronHandlers['cron.add']({
            req: { id: '1', method: 'cron.add' },
            params: {
                name: 'test-job',
                agentId: 'agent1',
                schedule: { kind: 'at', at: 'invalid-date' },
                sessionTarget: 'isolated'
            },
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload, err) => {
                expect(ok).toBe(false);
                expect(err?.code).toBe('invalid_request');
                responded = true;
            },
            context: {} as any
        });
        expect(responded).toBe(true);
    });

    it('should handle cron.remove', async () => {
        let responded = false;
        const mockCron = {
            remove: vi.fn().mockResolvedValue({ removed: true })
        };
        const context = {
            cron: mockCron,
            logGateway: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        };

        await cronHandlers['cron.remove']({
            req: { id: '1', method: 'cron.remove' },
            params: { id: 'job-123' },
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload, err) => {
                expect(ok).toBe(true);
                expect(payload).toEqual({ removed: true });
                responded = true;
            },
            context: context as any
        });

        expect(responded).toBe(true);
        expect(mockCron.remove).toHaveBeenCalledWith('job-123');
    });
});
