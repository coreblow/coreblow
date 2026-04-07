/**
 * src/infra/ports.ts
 * Mock port inspect to fix compilation.
 */

import type { PortUsage } from "./ports-types.js";

export async function inspectPortUsage(port: number): Promise<PortUsage> {
    return {
        port,
        status: "free",
        listeners: [],
        hints: []
    }
}

export type { PortListener, PortListenerKind, PortUsage, PortUsageStatus } from "./ports-types.js";
