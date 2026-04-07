/**
 * CoreBlow — App Bootstrapper
 *
 * Orchestrates the startup sequence of all gateway
 * subsystems. Manages initialization order, dependency
 * resolution, and startup health verification.
 */

/** Boot phase */
export interface BootPhase {
    name: string;
    order: number;
    init: () => Promise<void>;
    healthCheck?: () => Promise<boolean>;
    required: boolean;
}

/** Boot result */
export interface BootResult {
    success: boolean;
    phases: Array<{ name: string; status: 'ok' | 'failed' | 'skipped'; durationMs: number; error?: string }>;
    totalDurationMs: number;
}

/**
 * CoreBlow App Bootstrapper
 */
export class AppBootstrapper {
    private phases: BootPhase[] = [];
    private bootResult: BootResult | null = null;

    /**
     * Register a boot phase.
     */
    register(phase: BootPhase): void {
        this.phases.push(phase);
        this.phases.sort((a, b) => a.order - b.order);
    }

    /**
     * Boot all phases in order.
     */
    async boot(): Promise<BootResult> {
        const start = Date.now();
        const results: BootResult['phases'] = [];

        for (const phase of this.phases) {
            const phaseStart = Date.now();
            try {
                await phase.init();
                if (phase.healthCheck) {
                    const healthy = await phase.healthCheck();
                    if (!healthy) throw new Error('Health check failed');
                }
                results.push({ name: phase.name, status: 'ok', durationMs: Date.now() - phaseStart });
            } catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                if (phase.required) {
                    results.push({ name: phase.name, status: 'failed', durationMs: Date.now() - phaseStart, error });
                    this.bootResult = { success: false, phases: results, totalDurationMs: Date.now() - start };
                    return this.bootResult;
                }
                results.push({ name: phase.name, status: 'skipped', durationMs: Date.now() - phaseStart, error });
            }
        }

        this.bootResult = { success: true, phases: results, totalDurationMs: Date.now() - start };
        return this.bootResult;
    }

    /**
     * Get last boot result.
     */
    getBootResult(): BootResult | null { return this.bootResult; }

    /**
     * List registered phases.
     */
    list(): Array<{ name: string; order: number; required: boolean }> {
        return this.phases.map((p) => ({ name: p.name, order: p.order, required: p.required }));
    }

    /** Count */
    count(): number { return this.phases.length; }
}
