import type { GatewayLogger } from "./gateway-types.js";

export function createRestartSentinel(log: GatewayLogger) {
    let restartPending = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRestartReason = "";

    return {
        isRestartPending: () => restartPending,
        triggerRestart: (reason: string, delayMs: number = 3000) => {
            if (restartPending) {
                log.info(`Restart already pending, ignoring trigger: ${reason}`);
                return;
            }
            restartPending = true;
            lastRestartReason = reason;
            log.warn(`Triggering gateway restart in ${delayMs}ms. Reason: ${reason}`);
            
            restartTimer = setTimeout(() => {
                log.warn(`Executing queued restart: ${lastRestartReason}`);
                process.exit(0); // Orchestrator or systemd will restart
            }, delayMs);
        },
        cancelRestart: () => {
            if (!restartPending) return;
            restartPending = false;
            if (restartTimer) clearTimeout(restartTimer);
            log.info("Pending gateway restart cancelled.");
        }
    };
}
