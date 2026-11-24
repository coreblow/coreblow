/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import {
  createLazyFacadeObjectValue,
  createLazyFacadeValue,
  loadBundledPluginPublicSurfaceModuleSync,
} from "./facade-runtime.js";

export type ThreadBindingTargetKind = "subagent" | "acp";

export type ThreadBindingRecord = {
  accountId: string;
  channelId: string;
  threadId: string;
  targetKind: ThreadBindingTargetKind;
  targetSessionKey: string;
  agentId?: string;
  label?: string;
  boundBy?: string;
  boundAt: number;
  lastActivityAt: number;
  idleTimeoutMs?: number;
  maxAgeMs?: number;
};

export type ThreadBindingManager = {
  accountId: string;
  getByThreadId: (threadId: string) => ThreadBindingRecord | undefined;
  getIdleTimeoutMs: () => number;
  getMaxAgeMs: () => number;
  stop: () => void;
};

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

type FacadeModule = {
  __testing: {
    resetThreadBindingsForTests: () => void;
    [key: string]: unknown;
  };
  autoBindSpawnedDiscordSubagent: AsyncFn;
  createThreadBindingManager: (params: Record<string, unknown>) => ThreadBindingManager;
  getThreadBindingManager: (accountId?: string | null) => ThreadBindingManager | undefined;
  listThreadBindingsBySessionKey: (params: {
    targetSessionKey: string;
    accountId?: string;
    targetKind?: ThreadBindingTargetKind;
  }) => ThreadBindingRecord[];
  resolveThreadBindingIdleTimeoutMs: (params: {
    record: ThreadBindingRecord;
    defaultIdleTimeoutMs: number;
  }) => number;
  resolveThreadBindingInactivityExpiresAt: (params: {
    record: ThreadBindingRecord;
    defaultIdleTimeoutMs: number;
  }) => number | undefined;
  resolveThreadBindingMaxAgeExpiresAt: (params: {
    record: ThreadBindingRecord;
    defaultMaxAgeMs: number;
  }) => number | undefined;
  resolveThreadBindingMaxAgeMs: (params: {
    record: ThreadBindingRecord;
    defaultMaxAgeMs: number;
  }) => number;
  setThreadBindingIdleTimeoutBySessionKey: (params: {
    targetSessionKey: string;
    accountId?: string;
    idleTimeoutMs: number;
  }) => ThreadBindingRecord[];
  setThreadBindingMaxAgeBySessionKey: (params: {
    targetSessionKey: string;
    accountId?: string;
    maxAgeMs: number;
  }) => ThreadBindingRecord[];
  unbindThreadBindingsBySessionKey: (params: {
    targetSessionKey: string;
    accountId?: string;
    targetKind?: ThreadBindingTargetKind;
    reason?: string;
    sendFarewell?: boolean;
  }) => ThreadBindingRecord[];
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "discord",
    artifactBasename: "runtime-api.js",
  });
}

export const __testing: FacadeModule["__testing"] = createLazyFacadeObjectValue(
  () => loadFacadeModule().__testing,
);
export const autoBindSpawnedDiscordSubagent: FacadeModule["autoBindSpawnedDiscordSubagent"] =
  createLazyFacadeValue(loadFacadeModule, "autoBindSpawnedDiscordSubagent");
export const createThreadBindingManager: FacadeModule["createThreadBindingManager"] =
  createLazyFacadeValue(loadFacadeModule, "createThreadBindingManager");
export const getThreadBindingManager: FacadeModule["getThreadBindingManager"] =
  createLazyFacadeValue(loadFacadeModule, "getThreadBindingManager");
export const listThreadBindingsBySessionKey: FacadeModule["listThreadBindingsBySessionKey"] =
  createLazyFacadeValue(loadFacadeModule, "listThreadBindingsBySessionKey");
export const resolveThreadBindingIdleTimeoutMs: FacadeModule["resolveThreadBindingIdleTimeoutMs"] =
  createLazyFacadeValue(loadFacadeModule, "resolveThreadBindingIdleTimeoutMs");
export const resolveThreadBindingInactivityExpiresAt: FacadeModule["resolveThreadBindingInactivityExpiresAt"] =
  createLazyFacadeValue(loadFacadeModule, "resolveThreadBindingInactivityExpiresAt");
export const resolveThreadBindingMaxAgeExpiresAt: FacadeModule["resolveThreadBindingMaxAgeExpiresAt"] =
  createLazyFacadeValue(loadFacadeModule, "resolveThreadBindingMaxAgeExpiresAt");
export const resolveThreadBindingMaxAgeMs: FacadeModule["resolveThreadBindingMaxAgeMs"] =
  createLazyFacadeValue(loadFacadeModule, "resolveThreadBindingMaxAgeMs");
export const setThreadBindingIdleTimeoutBySessionKey: FacadeModule["setThreadBindingIdleTimeoutBySessionKey"] =
  createLazyFacadeValue(loadFacadeModule, "setThreadBindingIdleTimeoutBySessionKey");
export const setThreadBindingMaxAgeBySessionKey: FacadeModule["setThreadBindingMaxAgeBySessionKey"] =
  createLazyFacadeValue(loadFacadeModule, "setThreadBindingMaxAgeBySessionKey");
export const unbindThreadBindingsBySessionKey: FacadeModule["unbindThreadBindingsBySessionKey"] =
  createLazyFacadeValue(loadFacadeModule, "unbindThreadBindingsBySessionKey");
