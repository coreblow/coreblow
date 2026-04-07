/**
 * CoreBlow — Setup Wizard
 *
 * Interactive setup wizard that guides users through
 * initial configuration. Validates inputs, generates
 * config files, and verifies service connectivity.
 */

/** Wizard step */
export interface WizardStep {
    id: string;
    title: string;
    description: string;
    fields: WizardField[];
    validator?: (values: Record<string, unknown>) => { valid: boolean; errors: string[] };
}

/** Wizard field */
export interface WizardField {
    name: string;
    label: string;
    type: 'text' | 'password' | 'select' | 'boolean' | 'number';
    required?: boolean;
    default?: unknown;
    options?: string[];
    placeholder?: string;
    helpText?: string;
}

/** Wizard result */
export interface WizardResult {
    completed: boolean;
    values: Record<string, unknown>;
    steps: Array<{ stepId: string; completed: boolean }>;
    generatedConfig?: Record<string, unknown>;
}

/**
 * CoreBlow Setup Wizard
 */
export class SetupWizard {
    private steps: WizardStep[] = [];
    private values: Record<string, unknown> = {};
    private currentStep = 0;

    constructor() {
        // Default wizard steps
        this.addStep({
            id: 'provider',
            title: 'AI Provider Setup',
            description: 'Configure your AI provider',
            fields: [
                { name: 'provider', label: 'Provider', type: 'select', required: true, options: ['openai', 'anthropic', 'google'], default: 'openai' },
                { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
                { name: 'model', label: 'Model', type: 'text', default: 'gpt-4o' },
            ],
        });

        this.addStep({
            id: 'channel',
            title: 'Channel Setup',
            description: 'Configure your primary channel',
            fields: [
                { name: 'channel', label: 'Channel', type: 'select', options: ['discord', 'telegram', 'slack', 'whatsapp', 'webhook'], default: 'webhook' },
                { name: 'channelToken', label: 'Channel Token', type: 'password', placeholder: 'Bot token or API key' },
            ],
        });

        this.addStep({
            id: 'server',
            title: 'Server Configuration',
            description: 'Configure the gateway server',
            fields: [
                { name: 'port', label: 'Port', type: 'number', default: 3000 },
                { name: 'host', label: 'Host', type: 'text', default: '0.0.0.0' },
                { name: 'cors', label: 'Enable CORS', type: 'boolean', default: true },
                { name: 'rateLimit', label: 'Rate Limit (req/min)', type: 'number', default: 60 },
            ],
        });

        this.addStep({
            id: 'persona',
            title: 'Agent Persona',
            description: 'Choose your agent personality',
            fields: [
                { name: 'persona', label: 'Persona', type: 'select', options: ['default', 'coder', 'analyst', 'creative'], default: 'default' },
                { name: 'agentName', label: 'Agent Name', type: 'text', default: 'CoreBlow' },
                { name: 'temperature', label: 'Temperature', type: 'number', default: 0.7 },
            ],
        });
    }

    /**
     * Add a wizard step.
     */
    addStep(step: WizardStep): void {
        this.steps.push(step);
    }

    /**
     * Get current step.
     */
    getCurrentStep(): WizardStep | null {
        return this.steps[this.currentStep] ?? null;
    }

    /**
     * Submit values for the current step.
     */
    submitStep(values: Record<string, unknown>): { success: boolean; errors: string[] } {
        const step = this.getCurrentStep();
        if (!step) return { success: false, errors: ['No current step'] };

        // Validate required fields
        const errors: string[] = [];
        for (const field of step.fields) {
            if (field.required && !values[field.name] && values[field.name] !== false) {
                errors.push(`${field.label} is required`);
            }
        }

        // Custom validator
        if (step.validator) {
            const result = step.validator(values);
            if (!result.valid) errors.push(...result.errors);
        }

        if (errors.length > 0) return { success: false, errors };

        // Apply defaults and save
        for (const field of step.fields) {
            this.values[field.name] = values[field.name] ?? field.default;
        }

        this.currentStep++;
        return { success: true, errors: [] };
    }

    /**
     * Go to previous step.
     */
    previousStep(): boolean {
        if (this.currentStep <= 0) return false;
        this.currentStep--;
        return true;
    }

    /**
     * Check if wizard is complete.
     */
    isComplete(): boolean {
        return this.currentStep >= this.steps.length;
    }

    /**
     * Generate configuration from wizard values.
     */
    generateConfig(): Record<string, unknown> {
        return {
            provider: {
                name: this.values['provider'] ?? 'openai',
                apiKey: this.values['apiKey'],
                model: this.values['model'] ?? 'gpt-4o',
            },
            channel: {
                type: this.values['channel'] ?? 'webhook',
                token: this.values['channelToken'],
            },
            server: {
                port: this.values['port'] ?? 3000,
                host: this.values['host'] ?? '0.0.0.0',
                cors: this.values['cors'] ?? true,
                rateLimit: this.values['rateLimit'] ?? 60,
            },
            agent: {
                persona: this.values['persona'] ?? 'default',
                name: this.values['agentName'] ?? 'CoreBlow',
                temperature: this.values['temperature'] ?? 0.7,
            },
        };
    }

    /**
     * Get wizard result.
     */
    getResult(): WizardResult {
        return {
            completed: this.isComplete(),
            values: { ...this.values },
            steps: this.steps.map((s, i) => ({
                stepId: s.id,
                completed: i < this.currentStep,
            })),
            generatedConfig: this.isComplete() ? this.generateConfig() : undefined,
        };
    }

    /**
     * Reset the wizard.
     */
    reset(): void {
        this.currentStep = 0;
        this.values = {};
    }

    /** Step count */
    stepCount(): number { return this.steps.length; }
    /** Progress */
    progress(): number { return this.steps.length > 0 ? this.currentStep / this.steps.length : 0; }
}
