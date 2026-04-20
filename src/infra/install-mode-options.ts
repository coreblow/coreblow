export type InstallMode = "install" | "update";

export type InstallModeOptions<TLogger> = {
  logger?: TLogger;
  mode?: InstallMode;
  dryRun?: boolean;
};

export type TimedInstallModeOptions<TLogger> = InstallModeOptions<TLogger> & {
  timeoutMs?: number;
};

export function resolveInstallModeOptions<TLogger>(
  params: InstallModeOptions<TLogger>,
  defaultLogger: TLogger,
): {
  logger: TLogger;
  mode: InstallMode;
  dryRun: boolean;
} {
  return {
    logger: params.logger ?? defaultLogger,
    mode: params.mode ?? "install",
    dryRun: params.dryRun ?? false,
  };
}

export function resolveTimedInstallModeOptions<TLogger>(
  params: TimedInstallModeOptions<TLogger>,
  defaultLogger: TLogger,
  defaultTimeoutMs = 120_000,
): {
  logger: TLogger;
  timeoutMs: number;
  mode: InstallMode;
  dryRun: boolean;
} {
  return {
    ...resolveInstallModeOptions(params, defaultLogger),
    timeoutMs: params.timeoutMs ?? defaultTimeoutMs,
  };
}

// ---------------------------------------------------------------------------
// InstallModeOptionsService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "./service-patterns.js";

export class InstallModeOptionsService {
  [Symbol.toStringTag] = 'InstallModeOptionsService';
}

let _installModeOptionsInstance: InstallModeOptionsService | null = null;

export function getInstallModeOptionsService(): InstallModeOptionsService {
  if (!_installModeOptionsInstance) {
    _installModeOptionsInstance = new InstallModeOptionsService();
  }
  return _installModeOptionsInstance;
}

export const __testing_installModeOptions = createTestingHooks<InstallModeOptionsService>(
  () => { _installModeOptionsInstance = null; },
  (svc) => { _installModeOptionsInstance = svc; },
);
