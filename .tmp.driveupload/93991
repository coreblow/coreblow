/**
 * full-plugin — Config Schema
 */

export const configSchema = {
    validate(value: unknown) {
        if (!value || typeof value !== 'object') {
            return { ok: false as const, errors: ['Config must be an object'] };
        }
        return { ok: true as const, value };
    },
    uiHints: {
        apiKey: { label: 'API Key', sensitive: true },
    },
    jsonSchema: {
        type: 'object',
        properties: {
            apiKey: { type: 'string', description: 'API key for the service' },
            enabled: { type: 'boolean', default: true },
        },
    },
};
