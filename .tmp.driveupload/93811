import { describe, it, expect, vi } from 'vitest';
import { healthHandlers } from '../../src/gateway/server-methods/health.js';
import { doctorHandlers } from '../../src/gateway/server-methods/doctor.js';

describe('Gateway Health & Doctor RPC', () => {
    it('should return health status', async () => {
        let responded = false;
        await healthHandlers['health.status']({
            req: { id: '1', method: 'health.status' },
            params: {},
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload: any, err) => {
                expect(ok).toBe(true);
                expect(payload.status).toBe('ok');
                responded = true;
            },
            context: {} as any
        });
        expect(responded).toBe(true);
    });

    it('should return doctor memory status', async () => {
        let responded = false;
        await doctorHandlers['doctor.memory.status']({
            req: { id: '1', method: 'doctor.memory.status' },
            params: {},
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload: any, err) => {
                expect(ok).toBe(true);
                expect(payload.provider).toBe('coreblow_memory');
                responded = true;
            },
            context: {} as any
        });
        expect(responded).toBe(true);
    });
});
