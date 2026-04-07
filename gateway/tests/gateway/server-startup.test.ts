import { describe, it, expect } from 'vitest';
import { bootstrapCoreSubsystems } from '../../src/gateway/server-startup.js';

describe('Gateway Server Startup', () => {
    it('should bootstrap core subsystems', async () => {
        const context = await bootstrapCoreSubsystems({});
        
        expect(context).toHaveProperty('cron');
        expect(context.cron).toBeDefined();

        expect(context).toHaveProperty('wizardSessions');
        expect(context).toHaveProperty('findRunningWizard');
        expect(context).toHaveProperty('purgeWizardSession');

        expect(context.wizardSessions instanceof Map).toBe(true);
    });
});
