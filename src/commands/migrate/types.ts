import type { CoreBlowConfig } from "../../config/types.coreblow.js";

export type MigrationConfigPatchMode = "return";

export type MigrateCommonOptions = {
  provider?: string;
  source?: string;
  includeSecrets?: boolean;
  overwrite?: boolean;
  skills?: string[];
  plugins?: string[];
  verifyPluginApps?: boolean;
  json?: boolean;
  suppressPlanLog?: boolean;
  configOverride?: CoreBlowConfig;
  configPatchMode?: MigrationConfigPatchMode;
};

export type MigrationSummary = {
  totalItems: number;
  selectedItems: number;
  skippedItems: number;
  sections?: Array<{ label: string; count: number }>;
};

export type MigrationItem = {
  id: string;
  label: string;
  description?: string;
  kind?: string;
  current?: unknown;
  proposed?: unknown;
  selected?: boolean;
  readonly?: boolean;
  skipped?: boolean;
  skipReason?: string;
};

export type MigrationPlan = {
  providerId: string;
  source: string;
  target?: string;
  summary: MigrationSummary;
  items: MigrationItem[];
  warnings?: string[];
  nextSteps?: string[];
  metadata?: Record<string, unknown>;
};

export type MigrationApplyResult = MigrationPlan & {
  backupPath?: string;
  reportDir?: string;
};

export type MigrateApplyOptions = MigrateCommonOptions & {
  yes?: boolean;
  noBackup?: boolean;
  force?: boolean;
  backupOutput?: string;
  preflightPlan?: MigrationPlan;
};

export type MigrateDefaultOptions = MigrateApplyOptions & {
  dryRun?: boolean;
};
