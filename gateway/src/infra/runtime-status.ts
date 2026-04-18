/**
 * CoreBlow — Runtime Status
 *
 * Lightweight tracker for the gateway runtime lifecycle phase.
 * Used by health probes and diagnostics to report current state.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type RuntimePhase =
  | 'initializing'
  | 'starting'
  | 'running'
  | 'degraded'
  | 'shutting-down'
  | 'stopped';

export interface RuntimeStatusSnapshot {
  phase: RuntimePhase;
  uptimeMs: number;
  startedAt: number | null;
  lastTransition: number;
  version: string;
}

// ─── Singleton Tracker ──────────────────────────────────────────────────────

let currentPhase: RuntimePhase = 'initializing';
let startedAt: number | null = null;
let lastTransition = Date.now();
let runtimeVersion = '0.0.0';

/**
 * Transition the runtime to a new phase.
 * Ignores invalid transitions (e.g., stopped → running).
 */
export function setRuntimePhase(phase: RuntimePhase): void {
  if (currentPhase === 'stopped' && phase !== 'initializing') return;
  currentPhase = phase;
  lastTransition = Date.now();
  if (phase === 'running' && !startedAt) {
    startedAt = Date.now();
  }
}

/** Set the runtime version string (typically from package.json) */
export function setRuntimeVersion(version: string): void {
  runtimeVersion = version;
}

/** Get the current runtime phase */
export function getRuntimePhase(): RuntimePhase {
  return currentPhase;
}

/** Check if the runtime is in a healthy operational phase */
export function isRuntimeHealthy(): boolean {
  return currentPhase === 'running';
}

/** Check if the runtime accepts new work */
export function isRuntimeReady(): boolean {
  return currentPhase === 'running' || currentPhase === 'degraded';
}

/** Get a complete status snapshot */
export function getRuntimeStatus(): RuntimeStatusSnapshot {
  return {
    phase: currentPhase,
    uptimeMs: startedAt ? Date.now() - startedAt : 0,
    startedAt,
    lastTransition,
    version: runtimeVersion,
  };
}

/** Reset (primarily for testing) */
export function resetRuntimeStatus(): void {
  currentPhase = 'initializing';
  startedAt = null;
  lastTransition = Date.now();
  runtimeVersion = '0.0.0';
}
