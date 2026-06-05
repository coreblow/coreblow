import fs from "node:fs/promises";
import path from "node:path";
import type { CoreBlowConfig } from "../config/config.js";

export const MIGRATION_REASON_TARGET_EXISTS = "target-exists";
export const MIGRATION_REASON_MISSING_SOURCE_OR_TARGET = "missing-source-or-target";

export type MigrationItem = {
  id: string;
  kind: string;
  action: string;
  status: "planned" | "applied" | "skipped" | "conflict" | "migrated" | "error";
  source?: string;
  target?: string;
  path?: string[];
  value?: unknown;
  message?: string;
  recommendation?: string;
  reason?: string;
  sensitive?: boolean;
  details?: Record<string, unknown>;
};

export type MigrationSummary = {
  total: number;
  planned: number;
  applied: number;
  skipped: number;
  conflicts: number;
  errors: number;
};

export function createMigrationItem(params: Omit<MigrationItem, "status"> & { status?: MigrationItem["status"] }): MigrationItem {
  return { status: "planned", ...params };
}

export function summarizeMigrationItems(items: readonly MigrationItem[]): MigrationSummary {
  return {
    total: items.length,
    planned: items.filter((item) => item.status === "planned").length,
    applied: items.filter((item) => item.status === "applied").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    conflicts: items.filter((item) => item.status === "conflict").length,
    errors: items.filter((item) => item.status === "error").length,
  };
}

export function createMigrationManualItem(params: {
  id: string;
  source?: string;
  message: string;
  recommendation?: string;
}): MigrationItem {
  return createMigrationItem({ ...params, kind: "manual", action: "manual" });
}

export function applyMigrationManualItem(item: MigrationItem): MigrationItem {
  return { ...item, status: "skipped" };
}

export function createMigrationConfigPatchItem(params: {
  id: string;
  source?: string;
  target?: string;
  path: string[];
  value: unknown;
  message?: string;
  conflict?: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}): MigrationItem {
  return createMigrationItem({
    ...params,
    kind: "config",
    action: "patch",
    status: params.conflict ? "conflict" : "planned",
  });
}

function getConfigPath(config: CoreBlowConfig, keys: readonly string[]): unknown {
  let current: unknown = config;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function hasMigrationConfigPatchConflict(
  config: CoreBlowConfig,
  keys: readonly string[],
  patch: Record<string, unknown>,
): boolean {
  const target = getConfigPath(config, keys);
  return Boolean(
    target &&
      typeof target === "object" &&
      Object.keys(patch).some((key) => key in (target as Record<string, unknown>)),
  );
}

export async function applyMigrationConfigPatchItem(
  ctx: { config: CoreBlowConfig; runtime?: { config?: unknown } },
  item: MigrationItem,
): Promise<MigrationItem> {
  const { applyConfigPatchToRuntime } = await import("./migration-runtime.js");
  return applyConfigPatchToRuntime(ctx, item);
}

export function redactMigrationPlan<T>(plan: T): T {
  return plan;
}

export function markMigrationItemError(item: MigrationItem, error: unknown): MigrationItem {
  return { ...item, status: "error", reason: error instanceof Error ? error.message : String(error) };
}

export function markMigrationItemConflict(
  item: MigrationItem,
  reason = MIGRATION_REASON_TARGET_EXISTS,
): MigrationItem {
  return { ...item, status: "conflict", reason };
}

export function markMigrationItemSkipped(item: MigrationItem, reason?: string): MigrationItem {
  return { ...item, status: "skipped", reason };
}

export async function copyFileIfExists(source: string, target: string): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await fs.cp(source, target, { recursive: true, force: true });
    } else {
      await fs.copyFile(source, target);
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
