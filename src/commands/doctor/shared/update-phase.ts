import { isTruthyEnvValue } from "../../../infra/env.js";

export const UPDATE_IN_PROGRESS_ENV = "COREBLOW_UPDATE_IN_PROGRESS";
export const UPDATE_POST_CORE_CONVERGENCE_ENV = "COREBLOW_UPDATE_POST_CORE_CONVERGENCE";
export const UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR_ENV =
  "COREBLOW_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR";
export const UPDATE_PARENT_SUPPORTS_DOCTOR_CONFIG_WRITE_ENV =
  "COREBLOW_UPDATE_PARENT_SUPPORTS_DOCTOR_CONFIG_WRITE";

/**
 * True iff the caller is the doctor pass that runs WHILE the core package
 * files are actively being swapped. Configured plugin repair is deferred to
 * the post-core convergence pass.
 */
export function isUpdatePackageSwapInProgress(env: NodeJS.ProcessEnv): boolean {
  if (isPostCoreConvergencePass(env)) {
    return false;
  }
  return (
    isTruthyEnvValue(env[UPDATE_IN_PROGRESS_ENV]) ||
    isTruthyEnvValue(env.OPENCLAW_UPDATE_IN_PROGRESS)
  );
}

export function shouldDeferConfiguredPluginInstallRepair(env: NodeJS.ProcessEnv): boolean {
  return (
    isUpdatePackageSwapInProgress(env) &&
    (isTruthyEnvValue(env[UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR_ENV]) ||
      isTruthyEnvValue(env.OPENCLAW_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR) ||
      isTruthyEnvValue(env[UPDATE_PARENT_SUPPORTS_DOCTOR_CONFIG_WRITE_ENV]) ||
      isTruthyEnvValue(env.OPENCLAW_UPDATE_PARENT_SUPPORTS_DOCTOR_CONFIG_WRITE))
  );
}

export function isLegacyParentWritableUpdateDoctorPass(env: NodeJS.ProcessEnv): boolean {
  const parentSupports =
    isTruthyEnvValue(env[UPDATE_PARENT_SUPPORTS_DOCTOR_CONFIG_WRITE_ENV]) ||
    isTruthyEnvValue(env.OPENCLAW_UPDATE_PARENT_SUPPORTS_DOCTOR_CONFIG_WRITE);
  const defer =
    isTruthyEnvValue(env[UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR_ENV]) ||
    isTruthyEnvValue(env.OPENCLAW_UPDATE_DEFER_CONFIGURED_PLUGIN_INSTALL_REPAIR);
  return isUpdatePackageSwapInProgress(env) && parentSupports && !defer;
}

export function isLegacyPackageUpdateDoctorPass(env: NodeJS.ProcessEnv): boolean {
  return isUpdatePackageSwapInProgress(env) && !shouldDeferConfiguredPluginInstallRepair(env);
}

export function isPostCoreConvergencePass(env: NodeJS.ProcessEnv): boolean {
  return (
    isTruthyEnvValue(env[UPDATE_POST_CORE_CONVERGENCE_ENV]) ||
    isTruthyEnvValue(env.OPENCLAW_UPDATE_POST_CORE_CONVERGENCE)
  );
}
