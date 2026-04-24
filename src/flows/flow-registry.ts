// @ts-nocheck
/**
 * flows/flow-registry.ts
 * Registry of flow definitions — onboarding, feedback, config wizard, etc.
 */

import type { FlowDefinition } from './types.js';

const flowDefs = new Map<string, FlowDefinition>();

/** Register a flow definition. */
export function registerFlow(def: FlowDefinition): void { flowDefs.set(def.name, def); }

/** Get a flow definition by name. */
export function getFlowDef(name: string): FlowDefinition | undefined { return flowDefs.get(name); }

/** List all registered flows. */
export function listFlows(): FlowDefinition[] { return Array.from(flowDefs.values()); }

// ─── Built-in Flows ──────────────────────────────────────────────

/** Onboarding flow — welcome new users. */
export const onboardingFlow: FlowDefinition = {
    name: 'onboarding',
    description: 'Welcome and configure new users',
    initialStep: 'welcome',
    timeoutMs: 600_000,
    steps: [
        { id: 'welcome', prompt: '👋 Welcome to CoreBlow! What should I call you?', next: 'model' },
        {
            id: 'model', prompt: '🤖 Which AI model do you prefer?\n1. GPT-4o\n2. Claude Sonnet\n3. Gemini Pro',
            validator: (input: string) => ({ valid: ['1', '2', '3'].includes(input.trim()), error: 'Please choose 1, 2, or 3.' }),
            transform: (input: string) => ({ '1': 'gpt-4o', '2': 'claude-sonnet-4-20250514', '3': 'gemini-2.5-pro' }[input.trim()]),
            next: 'done',
        },
        { id: 'done', prompt: '✅ All set! You can start chatting now. Type /help for commands.' },
    ],
};

/** Feedback flow — collect user feedback. */
export const feedbackFlow: FlowDefinition = {
    name: 'feedback',
    description: 'Collect user feedback',
    initialStep: 'rating',
    steps: [
        {
            id: 'rating', prompt: '⭐ How would you rate your experience? (1-5)',
            validator: (input: string) => {
                const n = parseInt(input);
                return { valid: n >= 1 && n <= 5, error: 'Please enter a number between 1 and 5.' };
            },
            transform: (input: string) => parseInt(input),
            next: 'comment',
        },
        { id: 'comment', prompt: '💬 Any additional comments? (type "skip" to skip)', next: 'thanks' },
        { id: 'thanks', prompt: '🙏 Thank you for your feedback!' },
    ],
};

// Auto-register built-in flows
registerFlow(onboardingFlow);
registerFlow(feedbackFlow);
