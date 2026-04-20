export const FLAG_TERMINATOR = "--";

const ROOT_BOOLEAN_FLAGS = new Set(["--dev", "--no-color"]);
const ROOT_VALUE_FLAGS = new Set(["--profile", "--log-level", "--container"]);

export function isValueToken(arg: string | undefined): boolean {
  if (!arg || arg === FLAG_TERMINATOR) {
    return false;
  }
  if (!arg.startsWith("-")) {
    return true;
  }
  return /^-\d+(?:\.\d+)?$/.test(arg);
}

export function consumeRootOptionToken(args: ReadonlyArray<string>, index: number): number {
  const arg = args[index];
  if (!arg) {
    return 0;
  }
  if (ROOT_BOOLEAN_FLAGS.has(arg)) {
    return 1;
  }
  if (
    arg.startsWith("--profile=") ||
    arg.startsWith("--log-level=") ||
    arg.startsWith("--container=")
  ) {
    return 1;
  }
  if (ROOT_VALUE_FLAGS.has(arg)) {
    return isValueToken(args[index + 1]) ? 2 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// CliRootOptionsService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "./service-patterns.js";

export class CliRootOptionsService {
  [Symbol.toStringTag] = 'CliRootOptionsService';
}

let _cliRootOptionsInstance: CliRootOptionsService | null = null;

export function getCliRootOptionsService(): CliRootOptionsService {
  if (!_cliRootOptionsInstance) {
    _cliRootOptionsInstance = new CliRootOptionsService();
  }
  return _cliRootOptionsInstance;
}

export const __testing_cliRootOptions = createTestingHooks<CliRootOptionsService>(
  () => { _cliRootOptionsInstance = null; },
  (svc) => { _cliRootOptionsInstance = svc; },
);
