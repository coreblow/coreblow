import { describe, it, expect, vi } from 'vitest';
import { wizardHandlers } from '../../src/gateway/server-methods/wizard.js';
import { createWizardSessionTracker } from '../../src/gateway/server-wizard-sessions.js';

describe('Gateway Wizard RPC', () => {
    it('should start a wizard session', async () => {
        let responded = false;
        const context = {
            ...createWizardSessionTracker()
        } as any;

        await wizardHandlers['wizard.start']({
            req: { id: '1', method: 'wizard.start' },
            params: { mode: 'setup' },
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload: any, err) => {
                expect(ok).toBe(true);
                expect(payload).toHaveProperty('sessionId');
                expect(payload.done).toBe(true); // Since our mock next() returns done: true immediately
                responded = true;
            },
            context
        });
        expect(responded).toBe(true);
        // Since done = true, purge happens
        expect(context.wizardSessions.size).toBe(0);
    });

    it('should reject next if wizard does not exist', async () => {
        let responded = false;
        const context = {
            ...createWizardSessionTracker()
        } as any;

        await wizardHandlers['wizard.next']({
            req: { id: '1', method: 'wizard.next' },
            params: { sessionId: 'missing' },
            client: null,
            isWebchatConnect: () => false,
            respond: (ok, payload, err) => {
                expect(ok).toBe(false);
                expect(err?.code).toBe('invalid_request');
                responded = true;
            },
            context
        });
        expect(responded).toBe(true);
    });
});
