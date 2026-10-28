import {
  POSIX_COREBLOW_TMP_DIR,
  resolvePreferredCoreBlowTmpDir,
} from "./tmp-coreblow-dir.js";

export const POSIX_OPENCLAW_TMP_DIR = POSIX_COREBLOW_TMP_DIR;
export const resolvePreferredOpenClawTmpDir = resolvePreferredCoreBlowTmpDir;
export { resolvePreferredCoreBlowTmpDir };
