import type { CoreBlowConfig } from "./gateway-types.js";

export function resolveHookPolicy(hookName: string, cfg: Record<string, unknown>): boolean {
    const hooks = cfg.hooks as Record<string, unknown> | undefined;
    if (!hooks) return true;
    const disabled = hooks.disabled as string[] | undefined;
    if (Array.isArray(disabled) && disabled.includes(hookName)) {
        return false;
    }
    return true;
}
