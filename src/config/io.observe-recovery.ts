import crypto from "node:crypto";
import path from "node:path";
import { isPlainObject } from "../infra/plain-object.js";
import {
  appendConfigAuditRecord,
  appendConfigAuditRecordSync,
  snapshotConfigAuditProcessInfo,
  type ConfigObserveAuditRecord,
} from "./io.audit.js";
import {
  persistBoundedClobberedConfigSnapshot,
  persistBoundedClobberedConfigSnapshotSync,
} from "./io.clobber-snapshot.js";
import type { ConfigFileSnapshot } from "./types.js";

export type ObserveRecoveryDeps = {
  fs: {
    promises: {
      stat(path: string): Promise<{
        mtimeMs?: number;
        ctimeMs?: number;
        dev?: number | bigint;
        ino?: number | bigint;
        mode?: number;
        nlink?: number;
        uid?: number;
        gid?: number;
      } | null>;
      readFile(path: string, encoding: BufferEncoding): Promise<string>;
      writeFile(
        path: string,
        data: string,
        options?: { encoding?: BufferEncoding; mode?: number; flag?: string },
      ): Promise<unknown>;
      copyFile(src: string, dest: string): Promise<unknown>;
      chmod?(path: string, mode: number): Promise<unknown>;
      mkdir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<unknown>;
      readdir(path: string): Promise<string[]>;
      rmdir(path: string): Promise<unknown>;
      unlink(path: string): Promise<unknown>;
      appendFile(
        path: string,
        data: string,
        options?: { encoding?: BufferEncoding; mode?: number },
      ): Promise<unknown>;
    };
    statSync(
      path: string,
      options?: { throwIfNoEntry?: boolean },
    ): {
      mtimeMs?: number;
      ctimeMs?: number;
      dev?: number | bigint;
      ino?: number | bigint;
      mode?: number;
      nlink?: number;
      uid?: number;
      gid?: number;
    } | null;
    readFileSync(path: string, encoding: BufferEncoding): string;
    writeFileSync(
      path: string,
      data: string,
      options?: { encoding?: BufferEncoding; mode?: number; flag?: string },
    ): unknown;
    copyFileSync(src: string, dest: string): unknown;
    chmodSync?(path: string, mode: number): unknown;
    mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): unknown;
    readdirSync(path: string): string[];
    rmdirSync(path: string): unknown;
    unlinkSync(path: string): unknown;
    appendFileSync(
      path: string,
      data: string,
      options?: { encoding?: BufferEncoding; mode?: number },
    ): unknown;
  };
  json5: { parse(value: string): unknown };
  env: NodeJS.ProcessEnv;
  homedir: () => string;
  logger: Pick<typeof console, "warn">;
};

type ConfigHealthFingerprint = {
  hash: string;
  bytes: number;
  hasMeta: boolean;
  gatewayMode: string | null;
  observedAt: string;
};

type ConfigHealthEntry = {
  lastKnownGood?: ConfigHealthFingerprint;
  lastObservedSuspiciousSignature?: string | null;
};

type ConfigHealthState = {
  entries?: Record<string, ConfigHealthEntry>;
};

function hashConfigRaw(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function parseConfigRawOrEmpty(deps: ObserveRecoveryDeps, raw: string): unknown {
  try {
    return deps.json5.parse(raw);
  } catch {
    return {};
  }
}

function hasConfigMeta(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    isPlainObject(value.meta) &&
    (typeof value.meta.lastTouchedVersion === "string" ||
      typeof value.meta.lastTouchedAt === "string")
  );
}

function resolveGatewayMode(value: unknown): string | null {
  if (!isPlainObject(value) || !isPlainObject(value.gateway)) {
    return null;
  }
  return typeof value.gateway.mode === "string" ? value.gateway.mode : null;
}

function createConfigHealthFingerprint(params: {
  raw: string;
  parsed: unknown;
  observedAt: string;
}): ConfigHealthFingerprint {
  return {
    hash: hashConfigRaw(params.raw),
    bytes: Buffer.byteLength(params.raw, "utf-8"),
    hasMeta: hasConfigMeta(params.parsed),
    gatewayMode: resolveGatewayMode(params.parsed),
    observedAt: params.observedAt,
  };
}

function resolveConfigHealthStatePath(env: NodeJS.ProcessEnv, homedir: () => string): string {
  return path.join(homedir(), ".coreblow", "logs", "config-health.json");
}

async function readConfigHealthState(deps: ObserveRecoveryDeps): Promise<ConfigHealthState> {
  try {
    const raw = await deps.fs.promises.readFile(
      resolveConfigHealthStatePath(deps.env, deps.homedir),
      "utf-8",
    );
    const parsed = deps.json5.parse(raw);
    return isPlainObject(parsed) ? (parsed as ConfigHealthState) : {};
  } catch {
    return {};
  }
}

function readConfigHealthStateSync(deps: ObserveRecoveryDeps): ConfigHealthState {
  try {
    const raw = deps.fs.readFileSync(resolveConfigHealthStatePath(deps.env, deps.homedir), "utf-8");
    const parsed = deps.json5.parse(raw);
    return isPlainObject(parsed) ? (parsed as ConfigHealthState) : {};
  } catch {
    return {};
  }
}

async function writeConfigHealthState(
  deps: ObserveRecoveryDeps,
  state: ConfigHealthState,
): Promise<void> {
  const healthPath = resolveConfigHealthStatePath(deps.env, deps.homedir);
  try {
    await deps.fs.promises.mkdir(path.dirname(healthPath), { recursive: true, mode: 0o700 });
    await deps.fs.promises.writeFile(healthPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch (err) {
    deps.logger.warn(`Config health-state write failed: ${String(err)}`);
  }
}

function writeConfigHealthStateSync(deps: ObserveRecoveryDeps, state: ConfigHealthState): void {
  const healthPath = resolveConfigHealthStatePath(deps.env, deps.homedir);
  try {
    deps.fs.mkdirSync(path.dirname(healthPath), { recursive: true, mode: 0o700 });
    deps.fs.writeFileSync(healthPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch (err) {
    deps.logger.warn(`Config health-state write failed: ${String(err)}`);
  }
}

function getConfigHealthEntry(state: ConfigHealthState, configPath: string): ConfigHealthEntry {
  const entries = state.entries;
  if (!entries || !isPlainObject(entries)) {
    return {};
  }
  const entry = entries[configPath];
  return entry && isPlainObject(entry) ? entry : {};
}

function setConfigHealthEntry(
  state: ConfigHealthState,
  configPath: string,
  entry: ConfigHealthEntry,
): ConfigHealthState {
  return {
    ...state,
    entries: {
      ...state.entries,
      [configPath]: entry,
    },
  };
}

function isUpdateChannelOnlyRoot(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "update") {
    return false;
  }
  const update = value.update;
  return (
    isPlainObject(update) &&
    Object.keys(update).length === 1 &&
    typeof update.channel === "string"
  );
}

function resolveConfigObserveSuspiciousReasons(params: {
  current: ConfigHealthFingerprint;
  parsed: unknown;
  baseline?: ConfigHealthFingerprint;
}): string[] {
  const reasons: string[] = [];
  const baseline = params.baseline;
  if (!baseline) {
    return reasons;
  }
  if (baseline.bytes >= 512 && params.current.bytes < Math.floor(baseline.bytes * 0.5)) {
    reasons.push(`size-drop-vs-last-good:${baseline.bytes}->${params.current.bytes}`);
  }
  if (baseline.hasMeta && !params.current.hasMeta) {
    reasons.push("missing-meta-vs-last-good");
  }
  if (baseline.gatewayMode && !params.current.gatewayMode) {
    reasons.push("gateway-mode-missing-vs-last-good");
  }
  if (baseline.gatewayMode && isUpdateChannelOnlyRoot(params.parsed)) {
    reasons.push("update-channel-only-root");
  }
  return reasons;
}

function resolveSuspiciousSignature(
  current: ConfigHealthFingerprint,
  suspicious: string[],
): string {
  return `${current.hash}:${suspicious.join(",")}`;
}

function createObserveRecord(params: {
  configPath: string;
  valid: boolean;
  current: ConfigHealthFingerprint;
  suspicious: string[];
  clobberedPath: string | null;
  restoredBackupPath: string | null;
  restoreErrorCode?: string | null;
  restoreErrorMessage?: string | null;
}): ConfigObserveAuditRecord {
  return {
    ts: new Date().toISOString(),
    source: "config-io",
    event: "config.observe",
    phase: "read",
    configPath: params.configPath,
    ...snapshotConfigAuditProcessInfo(),
    exists: true,
    valid: params.valid,
    hash: params.current.hash,
    bytes: params.current.bytes,
    suspicious: params.suspicious,
    clobberedPath: params.clobberedPath,
    restoredFromBackup: params.restoredBackupPath !== null,
    restoredBackupPath: params.restoredBackupPath,
    restoreErrorCode: params.restoreErrorCode ?? null,
    restoreErrorMessage: params.restoreErrorMessage ?? null,
  };
}

async function readFingerprintForPath(
  deps: ObserveRecoveryDeps,
  targetPath: string,
): Promise<ConfigHealthFingerprint | null> {
  try {
    const raw = await deps.fs.promises.readFile(targetPath, "utf-8");
    return createConfigHealthFingerprint({
      raw,
      parsed: parseConfigRawOrEmpty(deps, raw),
      observedAt: new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

function readFingerprintForPathSync(
  deps: ObserveRecoveryDeps,
  targetPath: string,
): ConfigHealthFingerprint | null {
  try {
    const raw = deps.fs.readFileSync(targetPath, "utf-8");
    return createConfigHealthFingerprint({
      raw,
      parsed: parseConfigRawOrEmpty(deps, raw),
      observedAt: new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export function resolveLastKnownGoodConfigPath(configPath: string): string {
  return `${configPath}.last-good`;
}

export async function promoteConfigSnapshotToLastKnownGood(params: {
  deps: ObserveRecoveryDeps;
  snapshot: Pick<ConfigFileSnapshot, "path" | "raw" | "parsed" | "valid">;
}): Promise<void> {
  if (!params.snapshot.valid || typeof params.snapshot.raw !== "string") {
    return;
  }
  const targetPath = resolveLastKnownGoodConfigPath(params.snapshot.path);
  await params.deps.fs.promises.writeFile(targetPath, params.snapshot.raw, {
    encoding: "utf-8",
    mode: 0o600,
  });
  const state = await readConfigHealthState(params.deps);
  await writeConfigHealthState(
    params.deps,
    setConfigHealthEntry(state, params.snapshot.path, {
      ...getConfigHealthEntry(state, params.snapshot.path),
      lastKnownGood: createConfigHealthFingerprint({
        raw: params.snapshot.raw,
        parsed: params.snapshot.parsed,
        observedAt: new Date().toISOString(),
      }),
    }),
  );
}

export function promoteConfigSnapshotToLastKnownGoodSync(params: {
  deps: ObserveRecoveryDeps;
  snapshot: Pick<ConfigFileSnapshot, "path" | "raw" | "parsed" | "valid">;
}): void {
  if (!params.snapshot.valid || typeof params.snapshot.raw !== "string") {
    return;
  }
  const targetPath = resolveLastKnownGoodConfigPath(params.snapshot.path);
  params.deps.fs.writeFileSync(targetPath, params.snapshot.raw, {
    encoding: "utf-8",
    mode: 0o600,
  });
  const state = readConfigHealthStateSync(params.deps);
  writeConfigHealthStateSync(
    params.deps,
    setConfigHealthEntry(state, params.snapshot.path, {
      ...getConfigHealthEntry(state, params.snapshot.path),
      lastKnownGood: createConfigHealthFingerprint({
        raw: params.snapshot.raw,
        parsed: params.snapshot.parsed,
        observedAt: new Date().toISOString(),
      }),
    }),
  );
}

export async function recoverConfigFromLastKnownGood(params: {
  deps: ObserveRecoveryDeps;
  configPath: string;
}): Promise<string | null> {
  const sourcePath = resolveLastKnownGoodConfigPath(params.configPath);
  try {
    const raw = await params.deps.fs.promises.readFile(sourcePath, "utf-8");
    await params.deps.fs.promises.writeFile(params.configPath, raw, {
      encoding: "utf-8",
      mode: 0o600,
    });
    await params.deps.fs.promises.chmod?.(params.configPath, 0o600);
    return raw;
  } catch {
    return null;
  }
}

export function recoverConfigFromLastKnownGoodSync(params: {
  deps: ObserveRecoveryDeps;
  configPath: string;
}): string | null {
  const sourcePath = resolveLastKnownGoodConfigPath(params.configPath);
  try {
    const raw = params.deps.fs.readFileSync(sourcePath, "utf-8");
    params.deps.fs.writeFileSync(params.configPath, raw, {
      encoding: "utf-8",
      mode: 0o600,
    });
    params.deps.fs.chmodSync?.(params.configPath, 0o600);
    return raw;
  } catch {
    return null;
  }
}

export async function maybeRecoverSuspiciousConfigRead(params: {
  deps: ObserveRecoveryDeps;
  configPath: string;
  raw: string;
  parsed: unknown;
}): Promise<{ raw: string; parsed: unknown }> {
  const current = createConfigHealthFingerprint({
    raw: params.raw,
    parsed: params.parsed,
    observedAt: new Date().toISOString(),
  });
  const healthState = await readConfigHealthState(params.deps);
  const entry = getConfigHealthEntry(healthState, params.configPath);
  const backupPath = `${params.configPath}.bak`;
  const backupBaseline =
    entry.lastKnownGood ?? (await readFingerprintForPath(params.deps, backupPath)) ?? undefined;
  const suspicious = resolveConfigObserveSuspiciousReasons({
    current,
    parsed: params.parsed,
    baseline: backupBaseline,
  });
  if (suspicious.length === 0) {
    return { raw: params.raw, parsed: params.parsed };
  }
  const signature = resolveSuspiciousSignature(current, suspicious);
  if (entry.lastObservedSuspiciousSignature === signature) {
    return { raw: params.raw, parsed: params.parsed };
  }

  const backupRaw =
    (await params.deps.fs.promises.readFile(backupPath, "utf-8").catch(() => null)) ??
    (await params.deps.fs.promises
      .readFile(resolveLastKnownGoodConfigPath(params.configPath), "utf-8")
      .catch(() => null));
  const clobberedPath = await persistBoundedClobberedConfigSnapshot({
    deps: { fs: params.deps.fs, logger: params.deps.logger },
    configPath: params.configPath,
    raw: params.raw,
    observedAt: current.observedAt,
  });

  let restoredBackupPath: string | null = null;
  let restoredRaw = params.raw;
  let restoredParsed = params.parsed;
  let restoreErrorCode: string | null = null;
  let restoreErrorMessage: string | null = null;
  if (backupRaw) {
    restoredBackupPath = backupPath;
    restoredRaw = backupRaw;
    restoredParsed = parseConfigRawOrEmpty(params.deps, backupRaw);
    await params.deps.fs.promises.writeFile(params.configPath, backupRaw, {
      encoding: "utf-8",
      mode: 0o600,
    });
    params.deps.logger.warn(`Config observe recovery: restored ${params.configPath} from backup`);
  } else {
    restoreErrorCode = "ENOENT";
    restoreErrorMessage = "No config backup or last-good snapshot was available";
  }

  await appendConfigAuditRecord({
    fs: params.deps.fs,
    env: params.deps.env,
    homedir: params.deps.homedir,
    record: createObserveRecord({
      configPath: params.configPath,
      valid: false,
      current,
      suspicious,
      clobberedPath,
      restoredBackupPath,
      restoreErrorCode,
      restoreErrorMessage,
    }),
  });
  await writeConfigHealthState(
    params.deps,
    setConfigHealthEntry(healthState, params.configPath, {
      ...entry,
      lastObservedSuspiciousSignature: signature,
    }),
  );
  return { raw: restoredRaw, parsed: restoredParsed };
}

export function maybeRecoverSuspiciousConfigReadSync(params: {
  deps: ObserveRecoveryDeps;
  configPath: string;
  raw: string;
  parsed: unknown;
}): { raw: string; parsed: unknown } {
  const current = createConfigHealthFingerprint({
    raw: params.raw,
    parsed: params.parsed,
    observedAt: new Date().toISOString(),
  });
  const healthState = readConfigHealthStateSync(params.deps);
  const entry = getConfigHealthEntry(healthState, params.configPath);
  const backupPath = `${params.configPath}.bak`;
  const backupBaseline =
    entry.lastKnownGood ?? readFingerprintForPathSync(params.deps, backupPath) ?? undefined;
  const suspicious = resolveConfigObserveSuspiciousReasons({
    current,
    parsed: params.parsed,
    baseline: backupBaseline,
  });
  if (suspicious.length === 0) {
    return { raw: params.raw, parsed: params.parsed };
  }
  const signature = resolveSuspiciousSignature(current, suspicious);
  if (entry.lastObservedSuspiciousSignature === signature) {
    return { raw: params.raw, parsed: params.parsed };
  }

  let backupRaw: string | null = null;
  let restoredBackupPath: string | null = null;
  try {
    backupRaw = params.deps.fs.readFileSync(backupPath, "utf-8");
    restoredBackupPath = backupPath;
  } catch {
    try {
      const lastGoodPath = resolveLastKnownGoodConfigPath(params.configPath);
      backupRaw = params.deps.fs.readFileSync(lastGoodPath, "utf-8");
      restoredBackupPath = lastGoodPath;
    } catch {}
  }
  const clobberedPath = persistBoundedClobberedConfigSnapshotSync({
    deps: { fs: params.deps.fs, logger: params.deps.logger },
    configPath: params.configPath,
    raw: params.raw,
    observedAt: current.observedAt,
  });

  let restoredRaw = params.raw;
  let restoredParsed = params.parsed;
  let restoreErrorCode: string | null = null;
  let restoreErrorMessage: string | null = null;
  if (backupRaw) {
    restoredRaw = backupRaw;
    restoredParsed = parseConfigRawOrEmpty(params.deps, backupRaw);
    params.deps.fs.writeFileSync(params.configPath, backupRaw, {
      encoding: "utf-8",
      mode: 0o600,
    });
    params.deps.logger.warn(`Config observe recovery: restored ${params.configPath} from backup`);
  } else {
    restoreErrorCode = "ENOENT";
    restoreErrorMessage = "No config backup or last-good snapshot was available";
  }

  appendConfigAuditRecordSync({
    fs: params.deps.fs,
    env: params.deps.env,
    homedir: params.deps.homedir,
    record: createObserveRecord({
      configPath: params.configPath,
      valid: false,
      current,
      suspicious,
      clobberedPath,
      restoredBackupPath,
      restoreErrorCode,
      restoreErrorMessage,
    }),
  });
  writeConfigHealthStateSync(
    params.deps,
    setConfigHealthEntry(healthState, params.configPath, {
      ...entry,
      lastObservedSuspiciousSignature: signature,
    }),
  );
  return { raw: restoredRaw, parsed: restoredParsed };
}
