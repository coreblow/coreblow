/**
 * hooks/fire-and-forget.ts — Utility for fire-and-forget promise handling.
 *
 * Mirrors CoreBlow's fire-and-forget.ts.
 */

import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("hooks");

export function fireAndForgetHook(
    task: Promise<unknown>,
    label: string,
    logger: (message: string) => void = (msg) => log.warn(msg),
): void {
    void task.catch((err) => {
        logger(`${label}: ${String(err)}`);
    });
}
