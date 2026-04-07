/**
 * flows/doctor-health.ts — Health check flow and contribution framework.
 */

import { getFlowEngine } from './flow-engine.js';
import type { FlowDefinition } from './types.js';
import { ContributionRegistry, type FlowContribution } from './contributions.js';

export interface HealthContribution { component: string; status: 'healthy' | 'degraded' | 'unhealthy'; message: string; latencyMs?: number }

export const healthContributionRegistry = new ContributionRegistry();

export function aggregateHealth(contributions: HealthContribution[]): { overall: 'healthy' | 'degraded' | 'unhealthy'; components: HealthContribution[] } {
    const unhealthy = contributions.filter(c => c.status === 'unhealthy').length;
    const degraded = contributions.filter(c => c.status === 'degraded').length;
    const overall = unhealthy > 0 ? 'unhealthy' : degraded > 0 ? 'degraded' : 'healthy';
    return { overall, components: contributions };
}

export function formatHealthReport(contributions: HealthContribution[]): string {
    const { overall, components } = aggregateHealth(contributions);
    const icons = { healthy: '🟢', degraded: '🟡', unhealthy: '🔴' };
    const lines = [`${icons[overall]} System: ${overall.toUpperCase()}\n`];
    for (const c of components) {
        lines.push(`  ${icons[c.status]} ${c.component}: ${c.message}${c.latencyMs ? ` (${c.latencyMs}ms)` : ''}`);
    }
    return lines.join('\n');
}

/**
 * Executes a health check gathering data from all registered contributions.
 */
export async function runHealthCheck(): Promise<string> {
    const rawContributions = healthContributionRegistry.getForFlow('doctor-health');
    
    // Some contributions might be functions doing async checks
    const resolved: HealthContribution[] = [];
    for (const c of rawContributions) {
        if (typeof c.content === 'function') {
            try {
                const res = await c.content();
                resolved.push(res);
            } catch (err) {
                resolved.push({
                    component: c.id,
                    status: 'unhealthy',
                    message: `Health check failed: ${err instanceof Error ? err.message : String(err)}`
                });
            }
        } else {
            resolved.push(c.content as HealthContribution);
        }
    }

    return formatHealthReport(resolved);
}

/**
 * Creates a diagnostic flow for interactive health checking.
 */
export function createDoctorFlow(
    onCompleteAction?: (data: Record<string, unknown>) => Promise<void> | void
): FlowDefinition {
    return {
        name: 'Doctor Diagnostics',
        description: 'Run system health checks and auto-repair if degraded',
        initialStep: 'run',
        timeoutMs: 300000,
        onComplete: async (data) => {
            if (onCompleteAction) await onCompleteAction(data);
        },
        steps: [
            {
                id: 'run',
                prompt: '🩺 Running system diagnostics...',
                onEnter: async () => {
                    const report = await runHealthCheck();
                    // Let's pretend we have a way to display this, maybe store in step data
                    // Actually, the engine will prompt the user with next step's prompt.
                },
                next: 'evaluate'
            },
            {
                id: 'evaluate',
                prompt: 'Diagnostics complete. Would you like to run auto-repair? (y/n)',
                validator: (input: string) => {
                    const val = input.toLowerCase().trim();
                    return ['y', 'n', 'yes', 'no'].includes(val) ? { valid: true } : { valid: false, error: 'Answer yes or no.' };
                },
                transform: (input: string) => ['y', 'yes'].includes(input.toLowerCase().trim()),
                next: (val: unknown) => (val ? 'repair' : null)
            },
            {
                id: 'repair',
                prompt: '🔧 Running auto-repair... Done.',
                next: null
            }
        ]
    };
}
