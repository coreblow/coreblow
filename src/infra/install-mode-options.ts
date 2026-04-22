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

import { createStandaloneSingleton } from "./service-patterns.js";
export class InstallModeOptionsService {
  [Symbol.toStringTag] = 'InstallModeOptionsService';
}


const { getInstance: getInstallModeOptionsService, __testing: __testing_installModeOptions } =
  createStandaloneSingleton({ create: () => new InstallModeOptionsService(), defaultDeps: {} });

export { getInstallModeOptionsService, __testing_installModeOptions };
