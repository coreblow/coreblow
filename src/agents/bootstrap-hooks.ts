/**
 * agents/bootstrap-hooks.ts
 * Hook points for agent bootstrap lifecycle.
 * Ported from CoreBlow reference src/agents/bootstrap-hooks.ts.
 */

export type BootstrapPhase = 'pre_init' | 'post_init' | 'pre_turn' | 'post_turn' | 'pre_shutdown' | 'post_shutdown';

export type BootstrapHookFn = (context: BootstrapHookContext) => void | Promise<void>;

export interface BootstrapHookContext {
    phase: BootstrapPhase;
    sessionId: string;
    agentId: string;
    metadata?: Record<string, unknown>;
}

export class BootstrapHooks {
    private hooks = new Map<BootstrapPhase, BootstrapHookFn[]>();

    register(phase: BootstrapPhase, fn: BootstrapHookFn): void {
        const list = this.hooks.get(phase) ?? [];
        list.push(fn);
        this.hooks.set(phase, list);
    }

    async fire(context: BootstrapHookContext): Promise<void> {
        const fns = this.hooks.get(context.phase) ?? [];
        for (const fn of fns) {
            await fn(context);
        }
    }

    count(phase?: BootstrapPhase): number {
        if (phase) return (this.hooks.get(phase) ?? []).length;
        let total = 0;
        for (const fns of this.hooks.values()) total += fns.length;
        return total;
    }

    clear(phase?: BootstrapPhase): void {
        if (phase) this.hooks.delete(phase);
        else this.hooks.clear();
    }
}

/** OC-compat: apply hook overrides — CB delegates to BootstrapHooks class */
export async function applyBootstrapHookOverrides(params: {
  files: unknown[];
  workspaceDir: string;
  sessionKey?: string;
}): Promise<unknown[]> {
  // CB uses class-based BootstrapHooks; this compat shim returns files unchanged
  return params.files;
}
