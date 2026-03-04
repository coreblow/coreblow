/**
 * src/agents/steering.ts
 * Steering controller — abort, redirect, or modify AI responses mid-stream
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('steering');

export interface SteeringSignal {
    type: 'abort' | 'redirect' | 'pause' | 'resume';
    reason?: string;
    redirectTo?: string;  // new prompt or agent
    timestamp: number;
}

export class SteeringController {
    private sessions: Map<string, SteeringSignal> = new Map();
    private abortControllers: Map<string, AbortController> = new Map();

    /**
     * Register a new streaming session (call before starting a turn)
     */
    startSession(sessionId: string): AbortController {
        const controller = new AbortController();
        this.abortControllers.set(sessionId, controller);
        this.sessions.delete(sessionId);  // clear old signals
        return controller;
    }

    /**
     * Send a steering signal to an active session
     */
    steer(sessionId: string, signal: SteeringSignal) {
        this.sessions.set(sessionId, signal);

        if (signal.type === 'abort') {
            const controller = this.abortControllers.get(sessionId);
            if (controller) {
                controller.abort();
                log.info({ sessionId, reason: signal.reason }, 'Stream aborted');
            }
        }

        log.info({ sessionId, type: signal.type }, 'Steering signal sent');
    }

    /**
     * Check if there's a pending signal for a session
     */
    getSignal(sessionId: string): SteeringSignal | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Consume (acknowledge) a signal
     */
    consumeSignal(sessionId: string): SteeringSignal | undefined {
        const signal = this.sessions.get(sessionId);
        this.sessions.delete(sessionId);
        return signal;
    }

    /**
     * Clean up after a session completes
     */
    endSession(sessionId: string) {
        this.sessions.delete(sessionId);
        this.abortControllers.delete(sessionId);
    }

    /**
     * Check if a session has been aborted
     */
    isAborted(sessionId: string): boolean {
        const controller = this.abortControllers.get(sessionId);
        return controller?.signal.aborted || false;
    }

    /**
     * Get the abort signal for a session (to pass to fetch/provider calls)
     */
    getAbortSignal(sessionId: string): AbortSignal | undefined {
        return this.abortControllers.get(sessionId)?.signal;
    }
}

/**
 * Singleton instance
 */
export const steering = new SteeringController();
