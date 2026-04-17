import { describe, it, expect, beforeEach } from 'vitest';
import { SetupWizard, type WizardStep } from './setup-wizard.js';

describe('Wizard Module', () => {
    describe('setup-wizard.ts: SetupWizard', () => {
        let wizard: SetupWizard;

        beforeEach(() => {
            wizard = new SetupWizard();
        });

        it('initializes with 4 default steps', () => {
            expect(wizard.stepCount()).toBe(4);
            expect(wizard.progress()).toBe(0);
        });

        it('getCurrentStep returns first step initially', () => {
            const step = wizard.getCurrentStep();
            expect(step).not.toBeNull();
            expect(step!.id).toBe('provider');
            expect(step!.fields.length).toBeGreaterThan(0);
        });

        it('submitStep validates required fields', () => {
            const result = wizard.submitStep({}); // missing provider & apiKey
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('required'))).toBe(true);
        });

        it('submitStep accepts valid values and advances', () => {
            const result = wizard.submitStep({ provider: 'openai', apiKey: 'sk-test123' });
            expect(result.success).toBe(true);
            expect(result.errors).toEqual([]);

            // Now on step 2
            const step = wizard.getCurrentStep();
            expect(step!.id).toBe('channel');
        });

        it('previousStep goes back', () => {
            wizard.submitStep({ provider: 'openai', apiKey: 'sk-test' });
            expect(wizard.getCurrentStep()!.id).toBe('channel');

            const went = wizard.previousStep();
            expect(went).toBe(true);
            expect(wizard.getCurrentStep()!.id).toBe('provider');
        });

        it('previousStep returns false at first step', () => {
            expect(wizard.previousStep()).toBe(false);
        });

        it('completes all steps and generates config', () => {
            wizard.submitStep({ provider: 'anthropic', apiKey: 'sk-ant', model: 'claude-3' });
            wizard.submitStep({ channel: 'discord', channelToken: 'bot-tk' });
            wizard.submitStep({ port: 8080, host: 'localhost', cors: true, rateLimit: 30 });
            wizard.submitStep({ persona: 'coder', agentName: 'TestBot', temperature: 0.5 });

            expect(wizard.isComplete()).toBe(true);
            expect(wizard.progress()).toBe(1);

            const config = wizard.generateConfig();
            expect(config.provider).toEqual({
                name: 'anthropic',
                apiKey: 'sk-ant',
                model: 'claude-3',
            });
            expect(config.server).toEqual({
                port: 8080,
                host: 'localhost',
                cors: true,
                rateLimit: 30,
            });
            expect(config.agent).toEqual({
                persona: 'coder',
                name: 'TestBot',
                temperature: 0.5,
            });
        });

        it('getResult includes step completion status', () => {
            wizard.submitStep({ provider: 'openai', apiKey: 'sk-x' });

            const result = wizard.getResult();
            expect(result.completed).toBe(false);
            expect(result.steps[0].stepId).toBe('provider');
            expect(result.steps[0].completed).toBe(true);
            expect(result.steps[1].completed).toBe(false);
            expect(result.generatedConfig).toBeUndefined(); // not complete yet
        });

        it('reset returns to first step', () => {
            wizard.submitStep({ provider: 'openai', apiKey: 'sk-x' });
            wizard.submitStep({ channel: 'webhook' });
            wizard.reset();

            expect(wizard.getCurrentStep()!.id).toBe('provider');
            expect(wizard.progress()).toBe(0);
            expect(wizard.isComplete()).toBe(false);
        });

        it('addStep adds a custom step', () => {
            const custom: WizardStep = {
                id: 'custom',
                title: 'Custom Step',
                description: 'Test',
                fields: [{ name: 'foo', label: 'Foo', type: 'text' }],
            };
            wizard.addStep(custom);
            expect(wizard.stepCount()).toBe(5);
        });

        it('submitStep applies defaults for optional fields', () => {
            // Provider step: apiKey required, model has default 'gpt-4o'
            wizard.submitStep({ provider: 'openai', apiKey: 'sk-y' });
            // Channel step: no required fields
            wizard.submitStep({});
            // Server step: uses defaults
            wizard.submitStep({});
            // Persona step: uses defaults
            wizard.submitStep({});

            expect(wizard.isComplete()).toBe(true);
            const config = wizard.generateConfig() as any;
            expect(config.provider.model).toBe('gpt-4o'); // default applied
            expect(config.server.port).toBe(3100);        // default applied
        });

        it('custom validator rejects invalid values', () => {
            const wiz = new SetupWizard();
            wiz.addStep({
                id: 'validated',
                title: 'Validated',
                description: 'Step with validator',
                fields: [{ name: 'age', label: 'Age', type: 'number' }],
                validator: (values) => {
                    if (typeof values.age === 'number' && values.age < 0) {
                        return { valid: false, errors: ['Age must be positive'] };
                    }
                    return { valid: true, errors: [] };
                },
            });

            // Go through default 4 steps first
            wiz.submitStep({ provider: 'openai', apiKey: 'sk-x' });
            wiz.submitStep({});
            wiz.submitStep({});
            wiz.submitStep({});

            // Now on custom step
            const result = wiz.submitStep({ age: -5 });
            expect(result.success).toBe(false);
            expect(result.errors).toContain('Age must be positive');
        });
    });
});
