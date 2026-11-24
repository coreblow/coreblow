/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
export {
  findMatrixAccountEntry,
  getMatrixScopedEnvVarNames,
  requiresExplicitMatrixDefaultAccount,
  resolveConfiguredMatrixAccountIds,
  resolveMatrixAccountStorageRoot,
  resolveMatrixChannelConfig,
  resolveMatrixCredentialsDir,
  resolveMatrixCredentialsPath,
  resolveMatrixDefaultOrOnlyAccountId,
  resolveMatrixLegacyFlatStoragePaths,
} from "../infra/matrix-account-core.js";
