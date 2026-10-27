import type { CoreBlowConfig } from "../config/config.js";
import type { PluginInstallRecord } from "../config/types.plugins.js";
import {
  loadInstalledPluginIndexInstallRecords,
  loadInstalledPluginIndexInstallRecordsSync,
  readPersistedInstalledPluginIndexInstallRecords,
  readPersistedInstalledPluginIndexInstallRecordsSync,
} from "./installed-plugin-index-record-reader.js";
import { resolveInstalledPluginIndexStorePath } from "./installed-plugin-index-store-path.js";
import {
  refreshPersistedInstalledPluginIndex,
  refreshPersistedInstalledPluginIndexSync,
} from "./installed-plugin-index-store.js";
import { type RefreshInstalledPluginIndexParams } from "./installed-plugin-index.js";
import { recordPluginInstall, type PluginInstallUpdate } from "./installs.js";

export {
  loadInstalledPluginIndexInstallRecords,
  loadInstalledPluginIndexInstallRecordsSync,
  readPersistedInstalledPluginIndexInstallRecords,
  readPersistedInstalledPluginIndexInstallRecordsSync,
};

export const PLUGIN_INSTALLS_CONFIG_PATH = ["plugins", "installs"] as const;

export type InstalledPluginIndexRecordStoreOptions = {
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  filePath?: string;
};

type InstalledPluginIndexRecordRefreshOptions = InstalledPluginIndexRecordStoreOptions &
  Partial<Omit<RefreshInstalledPluginIndexParams, "reason" | "installRecords">> & {
    now?: () => Date;
  };

export class InstalledPluginIndexRecordStore {
  public static resolveStorePath(options: InstalledPluginIndexRecordStoreOptions = {}): string {
    return resolveInstalledPluginIndexStorePath(options);
  }

  public static async writeRecords(
    records: Record<string, PluginInstallRecord>,
    options: InstalledPluginIndexRecordRefreshOptions = {},
  ): Promise<string> {
    await refreshPersistedInstalledPluginIndex({
      ...options,
      reason: "source-changed",
      installRecords: records,
    });
    return this.resolveStorePath(options);
  }

  public static writeRecordsSync(
    records: Record<string, PluginInstallRecord>,
    options: InstalledPluginIndexRecordRefreshOptions = {},
  ): string {
    refreshPersistedInstalledPluginIndexSync({
      ...options,
      reason: "source-changed",
      installRecords: records,
    });
    return this.resolveStorePath(options);
  }

  public static withRecords(
    config: CoreBlowConfig,
    records: Record<string, PluginInstallRecord>,
  ): CoreBlowConfig {
    return {
      ...config,
      plugins: {
        ...config.plugins,
        installs: records,
      },
    };
  }

  public static withoutRecords(config: CoreBlowConfig): CoreBlowConfig {
    if (!config.plugins?.installs) {
      return config;
    }
    const { installs: _installs, ...plugins } = config.plugins;
    if (Object.keys(plugins).length === 0) {
      const { plugins: _plugins, ...rest } = config;
      return rest;
    }
    return {
      ...config,
      plugins,
    };
  }
}

export function resolveInstalledPluginIndexRecordsStorePath(
  options: InstalledPluginIndexRecordStoreOptions = {},
): string {
  return InstalledPluginIndexRecordStore.resolveStorePath(options);
}

export async function writePersistedInstalledPluginIndexInstallRecords(
  records: Record<string, PluginInstallRecord>,
  options: InstalledPluginIndexRecordRefreshOptions = {},
): Promise<string> {
  return InstalledPluginIndexRecordStore.writeRecords(records, options);
}

export function writePersistedInstalledPluginIndexInstallRecordsSync(
  records: Record<string, PluginInstallRecord>,
  options: InstalledPluginIndexRecordRefreshOptions = {},
): string {
  return InstalledPluginIndexRecordStore.writeRecordsSync(records, options);
}

export function withPluginInstallRecords(
  config: CoreBlowConfig,
  records: Record<string, PluginInstallRecord>,
): CoreBlowConfig {
  return InstalledPluginIndexRecordStore.withRecords(config, records);
}

export function withoutPluginInstallRecords(config: CoreBlowConfig): CoreBlowConfig {
  return InstalledPluginIndexRecordStore.withoutRecords(config);
}

export function recordPluginInstallInRecords(
  records: Record<string, PluginInstallRecord>,
  update: PluginInstallUpdate,
): Record<string, PluginInstallRecord> {
  return recordPluginInstall({ plugins: { installs: records } }, update).plugins?.installs ?? {};
}

export function removePluginInstallRecordFromRecords(
  records: Record<string, PluginInstallRecord>,
  pluginId: string,
): Record<string, PluginInstallRecord> {
  const { [pluginId]: _removed, ...rest } = records;
  return rest;
}
