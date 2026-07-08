import type { Command } from "commander";
import type { PluginManifestRecord } from "../plugins/manifest-registry.js";
import {
  loadBundledPluginPublicSurfaceModuleSync,
  tryLoadActivatedBundledPluginPublicSurfaceModuleSync,
} from "./facade-runtime.js";
import { resolvePrivateQaBundledPluginsEnv } from "./private-qa-bundled-env.js";

export type QaRunnerCliRegistration = {
  commandName: string;
  register(qa: Command): void;
};

type QaRunnerRuntimeSurface = {
  qaRunnerCliRegistrations?: readonly QaRunnerCliRegistration[];
};

type QaRuntimeSurface = {
  defaultQaRuntimeModelForMode: (
    mode: string,
    options?: {
      alternate?: boolean;
      preferredLiveModel?: string;
    },
  ) => string;
  startQaLiveLaneGateway: (...args: unknown[]) => Promise<unknown>;
};

export type QaRunnerCliContribution =
  | {
      kind: "registered";
      plugin: PluginManifestRecord;
      registration: QaRunnerCliRegistration;
    }
  | {
      kind: "failed";
      plugin: PluginManifestRecord;
      error: unknown;
    };

function isMissingQaRuntimeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Unable to resolve bundled plugin public surface qa-lab/runtime-api.js" ||
      error.message.startsWith("Unable to open bundled plugin public surface "))
  );
}

export function loadQaRuntimeModule(): QaRuntimeSurface {
  const env = resolvePrivateQaBundledPluginsEnv();
  return loadBundledPluginPublicSurfaceModuleSync<QaRuntimeSurface>({
    dirName: "qa-lab",
    artifactBasename: "runtime-api.js",
    ...(env ? { env } : {}),
  });
}

export function isQaRuntimeAvailable(): boolean {
  try {
    loadQaRuntimeModule();
    return true;
  } catch (error) {
    if (isMissingQaRuntimeError(error)) {
      return false;
    }
    throw error;
  }
}

function loadQaRunnerRegistrations(): readonly QaRunnerCliRegistration[] {
  const env = resolvePrivateQaBundledPluginsEnv();
  const module = tryLoadActivatedBundledPluginPublicSurfaceModuleSync<QaRunnerRuntimeSurface>({
    dirName: "qa-lab",
    artifactBasename: "runtime-api.js",
    ...(env ? { env } : {}),
  });
  return module?.qaRunnerCliRegistrations ?? [];
}

// ponytail: collectQaRunnerCliContributions references plugin manifest commandName
// which does not exist in CoreBlow PluginManifestRecord yet. Re-enable when
// manifest schema adds commandName for qa-runner plugins.
// export function collectQaRunnerCliContributions(): QaRunnerCliContribution[] {
//   ...
// }

export { loadQaRunnerRegistrations };
