import type { CoreBlowConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
