export type {
  FileLockHandle,
  FileLockOptions,
  FileLockTimeoutError,
  FileLockStaleError,
} from "../plugin-sdk/file-lock.js";
export {
  acquireFileLock,
  drainFileLockStateForTest,
  FILE_LOCK_TIMEOUT_ERROR_CODE,
  FILE_LOCK_STALE_ERROR_CODE,
  resetFileLockStateForTest,
  withFileLock,
} from "../plugin-sdk/file-lock.js";
