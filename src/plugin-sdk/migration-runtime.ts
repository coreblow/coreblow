import fs from "node:fs/promises";
import path from "node:path";
import {
  copyFileIfExists,
  type MigrationItem,
  type MigrationSummary,
} from "./migration.js";
import type { CoreBlowConfig } from "../config/config.js";

export type MigrationPlan = {
  providerId: string;
  source: string;
  target: string;
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

export function withCachedMigrationConfigRuntime<T>(runtime: T | undefined, _config: CoreBlowConfig): T | undefined {
  return runtime;
}

export async function archiveMigrationItem(
  item: MigrationItem,
  reportDir: string,
): Promise<MigrationItem> {
  if (item.source) {
    await fs.mkdir(reportDir, { recursive: true });
  }
  return { ...item, status: "applied" };
}

export async function copyMigrationFileItem(
  item: MigrationItem,
  reportDir: string,
  _options: { overwrite?: boolean } = {},
): Promise<MigrationItem> {
  if (item.source && item.target) {
    await copyFileIfExists(item.source, item.target);
  } else if (item.source) {
    await fs.mkdir(reportDir, { recursive: true });
  }
  return { ...item, status: "applied" };
}

export async function writeMigrationReport(
  result: MigrationApplyResult,
  options: { title?: string } = {},
): Promise<void> {
  if (!result.reportDir) {
    return;
  }
  await fs.mkdir(result.reportDir, { recursive: true });
  await fs.writeFile(
    path.join(result.reportDir, "report.json"),
    `${JSON.stringify({ title: options.title, result }, null, 2)}\n`,
    "utf8",
  );
}
