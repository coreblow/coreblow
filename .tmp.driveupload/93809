import { describe, it, expect, vi } from 'vitest';
import { skillsHandlers } from '../../src/gateway/server-methods/skills.js';

describe('Gateway Skills RPC', () => {
    it('should handle skills.status', async () => {
        let responded = false;
        await skillsHandlers['skills.status']({
            req: { id: '1', method: 'skills.status' },
            params: {},
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload: any, err) => {
                expect(ok).toBe(true);
                expect(payload).toHaveProperty('skills');
                responded = true;
            },
            context: {} as any
        });
        expect(responded).toBe(true);
    });

    it('should handle skills.install', async () => {
        let responded = false;
        await skillsHandlers['skills.install']({
            req: { id: '1', method: 'skills.install' },
            params: { name: 'test-skill', installId: '123' },
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload: any, err) => {
                expect(ok).toBe(true);
                expect(payload?.ok).toBe(true);
                responded = true;
            },
            context: {} as any
        });
        expect(responded).toBe(true);
    });
});
