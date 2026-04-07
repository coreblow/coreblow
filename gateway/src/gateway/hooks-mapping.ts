export const CONFIG_PATH_TO_HOOK_MAP: Record<string, string> = {
    "gateway.port": "onPortChange",
    "gateway.tls": "onTlsChange", // Example mapping
};

export function resolveHooksForConfigChange(changedPaths: string[]): string[] {
    const hooksToRun = new Set<string>();
    for (const p of changedPaths) {
        if (CONFIG_PATH_TO_HOOK_MAP[p]) {
            hooksToRun.add(CONFIG_PATH_TO_HOOK_MAP[p]);
        }
    }
    return Array.from(hooksToRun);
}
