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

function mergeConfigPatch(target: Record<string, unknown>, keys: readonly string[], value: unknown): void {
  let current = target;
  for (const key of keys.slice(0, -1)) {
    const existing = current[key];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const finalKey = keys.at(-1);
  if (!finalKey) {
    return;
  }
  const existing = current[finalKey];
  if (
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    current[finalKey] = {
      ...(existing as Record<string, unknown>),
      ...(value as Record<string, unknown>),
    };
    return;
  }
  current[finalKey] = value;
}

export async function applyConfigPatchToRuntime(
  ctx: { config: CoreBlowConfig; runtime?: { config?: unknown } },
  item: MigrationItem,
): Promise<MigrationItem> {
  if (!item.path || item.value === undefined) {
    return { ...item, status: "applied" };
  }
  const runtimeConfig = ctx.runtime?.config as
    | {
        mutateConfigFile?: (params: {
          mutate: (draft: CoreBlowConfig, context: unknown) => Promise<unknown> | void;
          afterWrite?: unknown;
        }) => Promise<unknown>;
      }
    | undefined;
  if (runtimeConfig?.mutateConfigFile) {
    await runtimeConfig.mutateConfigFile({
      mutate: (draft) => {
        mergeConfigPatch(draft as Record<string, unknown>, item.path ?? [], item.value);
      },
    });
    return { ...item, status: "applied" };
  }
  mergeConfigPatch(ctx.config as Record<string, unknown>, item.path, item.value);
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
