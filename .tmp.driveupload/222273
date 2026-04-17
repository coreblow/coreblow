// @ts-nocheck
/**
 * flows/channel-setup-flow.ts — Multi-step channel setup flow.
 *
 * Implemented as a proper FlowDefinition for FlowEngine.
 */

import type { FlowDefinition } from './types.js';

export function createChannelSetupFlow(
    onCompleteAction?: (data: Record<string, unknown>) => Promise<void> | void,
    onCancelAction?: () => Promise<void> | void
): FlowDefinition {
    return {
        name: 'Channel Setup Wizard',
        description: 'Interactive wizard for setting up new communication channels',
        initialStep: 'select',
        timeoutMs: 600000, // 10 minutes
        onComplete: async (data: any) => {
            if (onCompleteAction) await onCompleteAction(data);
        },
        onCancel: async () => {
            if (onCancelAction) await onCancelAction();
        },
        steps: [
            {
                id: 'select',
                prompt: '📡 Select channel: discord, telegram, slack, whatsapp, line, signal',
                validator: (input: string) => {
                    const valid = ['discord', 'telegram', 'slack', 'whatsapp', 'line', 'signal'].includes(input.toLowerCase().trim());
                    return valid ? { valid: true } : { valid: false, error: 'Invalid channel. Please choose from the list.' };
                },
                transform: (input: string) => input.toLowerCase().trim(),
                next: 'credentials'
            },
            {
                id: 'credentials',
                prompt: '🔑 Enter token or credentials (format varies by channel):',
                validator: (input: string) => {
                    return input.trim().length > 0 ? { valid: true } : { valid: false, error: 'Token cannot be empty.' };
                },
                next: 'validate'
            },
            {
                id: 'validate',
                prompt: '✅ Validating credentials... (type "ok" to continue, or "retry" to re-enter)',
                onEnter: async () => {
                    // Logic to validate credentials can run here
                    // e.g. emit event or call service
                },
                validator: (input: string) => {
                    const val = input.toLowerCase().trim();
                    return ['ok', 'retry'].includes(val) ? { valid: true } : { valid: false, error: 'Type "ok" or "retry"' };
                },
                transform: (input: string) => input.toLowerCase().trim(),
                next: (val: unknown) => (val === 'retry' ? 'credentials' : 'test')
            },
            {
                id: 'test',
                prompt: '🔌 Testing connection... (type "ok" if successful)',
                next: 'enable'
            },
            {
                id: 'enable',
                prompt: '🟢 Enable channel? (yes/no)',
                validator: (input: any) => {
                    const val = input.toLowerCase().trim();
                    return ['yes', 'no', 'y', 'n'].includes(val) ? { valid: true } : { valid: false, error: 'Please answer yes or no.' };
                },
                transform: (input: any) => ['yes', 'y'].includes(input.toLowerCase().trim()),
                next: null // End of flow
            }
        ]
    };
}

export type SetupPhase = 'select' | 'credentials' | 'validate' | 'test' | 'enable' | 'complete';
export interface SetupFlowState { phase: SetupPhase; channel?: string; credentials: Record<string, string>; validationErrors: string[]; testResult?: { success: boolean; message: string } }

// Legacy stateless functions, kept for backwards compatibility if needed
export function createSetupFlow(): SetupFlowState { return { phase: 'select', credentials: {}, validationErrors: [] }; }

export function advanceSetupFlow(state: SetupFlowState, input?: string): SetupFlowState {
    switch (state.phase) {
        case 'select': return { ...state, phase: 'credentials', channel: input };
        case 'credentials': return { ...state, phase: 'validate' };
        case 'validate':
            const errors = validateCredentials(state.channel ?? '', state.credentials);
            return errors.length > 0 ? { ...state, validationErrors: errors } : { ...state, phase: 'test', validationErrors: [] };
        case 'test': return { ...state, phase: 'enable', testResult: { success: true, message: 'Connection OK' } };
        case 'enable': return { ...state, phase: 'complete' };
        default: return state;
    }
}

function validateCredentials(channel: string, creds: Record<string, string>): string[] {
    const errors: string[] = [];
    if (['discord', 'telegram', 'slack'].includes(channel) && !creds.token) errors.push('Token is required');
    if (channel === 'slack' && !creds.signingSecret) errors.push('Signing secret is required');
    return errors;
}

export function getSetupPrompt(state: SetupFlowState): string {
    const prompts: Record<SetupPhase, string> = {
        select: '📡 Select channel: discord, telegram, slack, whatsapp, line, signal',
        credentials: `🔑 Enter credentials for ${state.channel}`,
        validate: '✅ Validating credentials...',
        test: '🔌 Testing connection...',
        enable: '🟢 Enable channel?',
        complete: `✅ ${state.channel} setup complete!`,
    };
    return prompts[state.phase];
}
