import path from "node:path";
import {
  resolveBrowserConfig,
  resolveProfile,
  type ResolvedBrowserConfig,
  type ResolvedBrowserProfile,
} from "../../extensions/browser/src/browser/config.js";
import {
  DEFAULT_AI_SNAPSHOT_MAX_CHARS,
  DEFAULT_BROWSER_DEFAULT_PROFILE_NAME,
  DEFAULT_BROWSER_EVALUATE_ENABLED,
  DEFAULT_COREBLOW_BROWSER_COLOR,
  DEFAULT_COREBLOW_BROWSER_ENABLED,
  DEFAULT_COREBLOW_BROWSER_PROFILE_NAME,
} from "../../extensions/browser/src/browser/constants.js";
import { resolvePreferredCoreBlowTmpDir } from "../infra/tmp-coreblow-dir.js";

export {
  DEFAULT_AI_SNAPSHOT_MAX_CHARS,
  DEFAULT_BROWSER_DEFAULT_PROFILE_NAME,
  DEFAULT_BROWSER_EVALUATE_ENABLED,
  DEFAULT_COREBLOW_BROWSER_COLOR,
  DEFAULT_COREBLOW_BROWSER_ENABLED,
  DEFAULT_COREBLOW_BROWSER_PROFILE_NAME,
  resolveBrowserConfig,
  resolveProfile,
};
export type { ResolvedBrowserConfig, ResolvedBrowserProfile };

export const DEFAULT_BROWSER_ACTION_TIMEOUT_MS = 60_000;
export const DEFAULT_UPLOAD_DIR = path.join(resolvePreferredCoreBlowTmpDir(), "uploads");
