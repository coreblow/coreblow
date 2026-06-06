import path from "node:path";
import { resolveStateDir } from "./paths.js";

const CONFIG_AUDIT_ARGV_CAP = 8;
const CONFIG_AUDIT_LOG_FILENAME = "config-audit.jsonl";

const SECRET_FLAG_NAMES = new Set([
  "--token",
  "--api-key",
  "--apikey",
  "--secret",
  "--password",
  "--passwd",
  "--auth-token",
  "--access-token",
  "--refresh-token",
  "--client-secret",
  "--gateway-token",
  "--bot-token",
  "--webhook-secret",
  "--webhook-token",
  "--bearer",
  "--bearer-token",
  "--pat",
  "--personal-access-token",
  "--oauth-token",
  "--session-token",
  "--private-key",
  "--recovery-key",
  "--gateway-key",
  "--session-key",
]);

const SECRET_FLAG_SUFFIX_PATTERN =
  /^--(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?(?:token|secret|password|passwd|api[-_]?key|api[-_]?secret|webhook|credential|bearer|pat|private[-_]?key|recovery[-_]?key|signing[-_]?key|encryption[-_]?key|master[-_]?key|session[-_]?key|gateway[-_]?key|service[-_]?key|hook[-_]?key)$/;

const INLINE_SECRET_PATTERN =
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)=([^\s]+)/gi;

export type ConfigWriteAuditResult = "rename" | "copy-fallback" | "failed" | "rejected";

export type ConfigAuditStatMetadata = {
  dev: string | null;
  ino: string | null;
  mode: number | null;
  nlink: number | null;
  uid: number | null;
  gid: number | null;
};

export type ConfigAuditProcessInfo = {
  pid: number;
  ppid: number;
  cwd: string;
  argv: string[];
  execArgv: string[];
};

export type ConfigWriteAuditRecord = {
  ts: string;
  source: "config-io";
  event: "config.write";
  result: ConfigWriteAuditResult;
  configPath: string;
  pid: number;
  ppid: number;
  cwd: string;
  argv: string[];
  execArgv: string[];
  watchMode: boolean;
  watchSession: string | null;
  watchCommand: string | null;
  existsBefore: boolean;
  previousHash: string | null;
  nextHash: string | null;
  previousBytes: number | null;
  nextBytes: number | null;
  previousDev: string | null;
  previousIno: string | null;
  previousMode: number | null;
  previousNlink: number | null;
  previousUid: number | null;
  previousGid: number | null;
  nextDev: string | null;
  nextIno: string | null;
  nextMode: number | null;
  nextNlink: number | null;
  nextUid: number | null;
  nextGid: number | null;
  changedPathCount: number | null;
  hasMetaBefore: boolean;
  hasMetaAfter: boolean;
  gatewayModeBefore: string | null;
  gatewayModeAfter: string | null;
  suspicious: string[];
  errorCode?: string;
  errorMessage?: string;
};

export type ConfigObserveAuditRecord = {
  ts: string;
  source: "config-io";
  event: "config.observe";
  phase: "read";
  configPath: string;
  pid: number;
  ppid: number;
  cwd: string;
  argv: string[];
  execArgv: string[];
  exists: boolean;
  valid: boolean;
  hash: string | null;
  bytes: number | null;
  suspicious: string[];
  clobberedPath: string | null;
  restoredFromBackup: boolean;
  restoredBackupPath: string | null;
  restoreErrorCode: string | null;
  restoreErrorMessage: string | null;
};

type ConfigAuditRecord = ConfigWriteAuditRecord | ConfigObserveAuditRecord;

export type ConfigWriteAuditRecordBase = Omit<
  ConfigWriteAuditRecord,
  | "result"
  | "nextDev"
  | "nextIno"
  | "nextMode"
  | "nextNlink"
  | "nextUid"
  | "nextGid"
  | "errorCode"
  | "errorMessage"
> & {
  nextHash: string;
  nextBytes: number;
};

type ConfigAuditFs = {
  promises: {
    mkdir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<unknown>;
    appendFile(
      path: string,
      data: string,
      options?: { encoding?: BufferEncoding; mode?: number },
    ): Promise<unknown>;
  };
  mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): unknown;
  appendFileSync(
    path: string,
    data: string,
    options?: { encoding?: BufferEncoding; mode?: number },
  ): unknown;
};

type ConfigAuditAppendContext = {
  fs: ConfigAuditFs;
  env: NodeJS.ProcessEnv;
  homedir: () => string;
};

type ConfigAuditAppendParams = ConfigAuditAppendContext &
  (
    | {
        record: ConfigAuditRecord;
      }
    | ConfigAuditRecord
  );

type ConfigAuditScrubFs = {
  promises: {
    readFile(path: string, encoding: "utf-8"): Promise<string>;
    stat(path: string): Promise<{ size: number }>;
    writeFile(
      path: string,
      data: string,
      options?: { encoding?: BufferEncoding; mode?: number },
    ): Promise<unknown>;
    rename(oldPath: string, newPath: string): Promise<unknown>;
    unlink(path: string): Promise<unknown>;
  };
};

export type ConfigAuditScrubResult = {
  scanned: number;
  rewritten: number;
  skipped: number;
  aborted: boolean;
};

function isSecretFlagName(flagName: string | null): boolean {
  return flagName !== null && (SECRET_FLAG_NAMES.has(flagName) || SECRET_FLAG_SUFFIX_PATTERN.test(flagName));
}

function parseFlagName(arg: string): string | null {
  if (!arg.startsWith("--")) {
    return null;
  }
  const eq = arg.indexOf("=");
  return (eq === -1 ? arg : arg.slice(0, eq)).toLowerCase();
}

function redactInlineSecrets(value: string): string {
  return value.replace(INLINE_SECRET_PATTERN, "$1=***");
}

export function redactConfigAuditArgv(argv: readonly string[]): string[] {
  const result: string[] = [];
  let redactNext = false;
  for (const current of argv) {
    if (redactNext) {
      redactNext = false;
      result.push("***");
      continue;
    }
    const flag = parseFlagName(current);
    if (isSecretFlagName(flag)) {
      if (current.includes("=")) {
        const eq = current.indexOf("=");
        result.push(`${current.slice(0, eq + 1)}***`);
      } else {
        result.push(current);
        redactNext = true;
      }
      continue;
    }
    result.push(redactInlineSecrets(current));
  }
  return result;
}

function capArgv(argv: readonly string[] | undefined): string[] {
  return Array.isArray(argv) ? argv.slice(0, CONFIG_AUDIT_ARGV_CAP) : [];
}

export function snapshotConfigAuditProcessInfo(): ConfigAuditProcessInfo {
  return {
    pid: process.pid,
    ppid: process.ppid,
    cwd: process.cwd(),
    argv: redactConfigAuditArgv(capArgv(process.argv)),
    execArgv: redactConfigAuditArgv(capArgv(process.execArgv)),
  };
}

export function resolveConfigAuditLogPath(env: NodeJS.ProcessEnv, homedir: () => string): string {
  return path.join(resolveStateDir(env, homedir), "logs", CONFIG_AUDIT_LOG_FILENAME);
}

export function formatConfigOverwriteLogMessage(params: {
  configPath: string;
  previousHash: string | null;
  nextHash: string;
  changedPathCount?: number;
}): string {
  const changeSummary =
    typeof params.changedPathCount === "number" ? `, changedPaths=${params.changedPathCount}` : "";
  return `Config overwrite: ${params.configPath} (sha256 ${params.previousHash ?? "unknown"} -> ${params.nextHash}, backup=${params.configPath}.bak${changeSummary})`;
}

function normalizeAuditLabel(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveConfigAuditProcessInfo(
  processInfo?: ConfigAuditProcessInfo,
): ConfigAuditProcessInfo {
  if (!processInfo) {
    return snapshotConfigAuditProcessInfo();
  }
  return {
    ...processInfo,
    argv: redactConfigAuditArgv(capArgv(processInfo.argv)),
    execArgv: redactConfigAuditArgv(capArgv(processInfo.execArgv)),
  };
}

export function createConfigWriteAuditRecordBase(params: {
  configPath: string;
  env: NodeJS.ProcessEnv;
  existsBefore: boolean;
  previousHash: string | null;
  nextHash: string;
  previousBytes: number | null;
  nextBytes: number;
  previousMetadata: ConfigAuditStatMetadata;
  changedPathCount: number | null | undefined;
  hasMetaBefore: boolean;
  hasMetaAfter: boolean;
  gatewayModeBefore: string | null;
  gatewayModeAfter: string | null;
  suspicious: string[];
  now?: string;
  processInfo?: ConfigAuditProcessInfo;
}): ConfigWriteAuditRecordBase {
  const processSnapshot = resolveConfigAuditProcessInfo(params.processInfo);
  return {
    ts: params.now ?? new Date().toISOString(),
    source: "config-io",
    event: "config.write",
    configPath: params.configPath,
    pid: processSnapshot.pid,
    ppid: processSnapshot.ppid,
    cwd: processSnapshot.cwd,
    argv: processSnapshot.argv,
    execArgv: processSnapshot.execArgv,
    watchMode: params.env.COREBLOW_WATCH_MODE === "1",
    watchSession: normalizeAuditLabel(params.env.COREBLOW_WATCH_SESSION),
    watchCommand: normalizeAuditLabel(params.env.COREBLOW_WATCH_COMMAND),
    existsBefore: params.existsBefore,
    previousHash: params.previousHash,
    nextHash: params.nextHash,
    previousBytes: params.previousBytes,
    nextBytes: params.nextBytes,
    previousDev: params.previousMetadata.dev,
    previousIno: params.previousMetadata.ino,
    previousMode: params.previousMetadata.mode,
    previousNlink: params.previousMetadata.nlink,
    previousUid: params.previousMetadata.uid,
    previousGid: params.previousMetadata.gid,
    changedPathCount: typeof params.changedPathCount === "number" ? params.changedPathCount : null,
    hasMetaBefore: params.hasMetaBefore,
    hasMetaAfter: params.hasMetaAfter,
    gatewayModeBefore: params.gatewayModeBefore,
    gatewayModeAfter: params.gatewayModeAfter,
    suspicious: params.suspicious,
  };
}

export function finalizeConfigWriteAuditRecord(params: {
  base: ConfigWriteAuditRecordBase;
  result: ConfigWriteAuditResult;
  nextMetadata?: ConfigAuditStatMetadata | null;
  err?: unknown;
}): ConfigWriteAuditRecord {
  const errorCode =
    params.err &&
    typeof params.err === "object" &&
    "code" in params.err &&
    typeof params.err.code === "string"
      ? params.err.code
      : undefined;
  const errorMessage =
    params.err &&
    typeof params.err === "object" &&
    "message" in params.err &&
    typeof params.err.message === "string"
      ? params.err.message
      : undefined;
  const nextMetadata = params.nextMetadata ?? {
    dev: null,
    ino: null,
    mode: null,
    nlink: null,
    uid: null,
    gid: null,
  };
  const success = params.result !== "failed" && params.result !== "rejected";
  return {
    ...params.base,
    result: params.result,
    nextHash: success ? params.base.nextHash : null,
    nextBytes: success ? params.base.nextBytes : null,
    nextDev: success ? nextMetadata.dev : null,
    nextIno: success ? nextMetadata.ino : null,
    nextMode: success ? nextMetadata.mode : null,
    nextNlink: success ? nextMetadata.nlink : null,
    nextUid: success ? nextMetadata.uid : null,
    nextGid: success ? nextMetadata.gid : null,
    errorCode,
    errorMessage,
  };
}

function redactAuditRecord(record: ConfigAuditRecord): ConfigAuditRecord {
  return {
    ...record,
    argv: redactConfigAuditArgv(record.argv),
    execArgv: redactConfigAuditArgv(record.execArgv),
  };
}

function resolveConfigAuditAppendRecord(params: ConfigAuditAppendParams): ConfigAuditRecord {
  if ("record" in params) {
    return redactAuditRecord(params.record);
  }
  const { fs: _fs, env: _env, homedir: _homedir, ...record } = params;
  return redactAuditRecord(record as ConfigAuditRecord);
}

export async function appendConfigAuditRecord(params: ConfigAuditAppendParams): Promise<void> {
  try {
    const auditPath = resolveConfigAuditLogPath(params.env, params.homedir);
    await params.fs.promises.mkdir(path.dirname(auditPath), { recursive: true, mode: 0o700 });
    await params.fs.promises.appendFile(
      auditPath,
      `${JSON.stringify(resolveConfigAuditAppendRecord(params))}\n`,
      { encoding: "utf-8", mode: 0o600 },
    );
  } catch {
    // best-effort
  }
}

export function appendConfigAuditRecordSync(params: ConfigAuditAppendParams): void {
  try {
    const auditPath = resolveConfigAuditLogPath(params.env, params.homedir);
    params.fs.mkdirSync(path.dirname(auditPath), { recursive: true, mode: 0o700 });
    params.fs.appendFileSync(auditPath, `${JSON.stringify(resolveConfigAuditAppendRecord(params))}\n`, {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // best-effort
  }
}

function redactAuditJsonLine(line: string): { line: string; changed: boolean; skipped: boolean } {
  if (!line) {
    return { line, changed: false, skipped: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { line, changed: false, skipped: true };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { line, changed: false, skipped: true };
  }
  const record = parsed as { argv?: unknown; execArgv?: unknown };
  const next = {
    ...record,
    argv: Array.isArray(record.argv) ? redactConfigAuditArgv(record.argv) : record.argv,
    execArgv: Array.isArray(record.execArgv) ? redactConfigAuditArgv(record.execArgv) : record.execArgv,
  };
  const nextLine = JSON.stringify(next);
  return { line: nextLine, changed: nextLine !== line, skipped: false };
}

export async function scrubConfigAuditLog(params: {
  fs: ConfigAuditScrubFs;
  env: NodeJS.ProcessEnv;
  homedir: () => string;
  dryRun?: boolean;
}): Promise<ConfigAuditScrubResult> {
  const auditPath = resolveConfigAuditLogPath(params.env, params.homedir);
  let raw: string;
  try {
    raw = await params.fs.promises.readFile(auditPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { scanned: 0, rewritten: 0, skipped: 0, aborted: false };
    }
    throw err;
  }

  const originalSize = (await params.fs.promises.stat(auditPath)).size;
  let scanned = 0;
  let rewritten = 0;
  let skipped = 0;
  const lines = raw.split("\n").map((line) => {
    const result = redactAuditJsonLine(line);
    if (line) {
      scanned += 1;
    }
    if (result.changed) {
      rewritten += 1;
    }
    if (result.skipped) {
      skipped += 1;
    }
    return result.line;
  });

  if (rewritten === 0 || params.dryRun) {
    return { scanned, rewritten, skipped, aborted: false };
  }

  if ((await params.fs.promises.stat(auditPath)).size !== originalSize) {
    return { scanned, rewritten, skipped, aborted: true };
  }

  const tmpPath = `${auditPath}.scrub.tmp`;
  try {
    await params.fs.promises.writeFile(tmpPath, lines.join("\n"), {
      encoding: "utf-8",
      mode: 0o600,
    });
    await params.fs.promises.rename(tmpPath, auditPath);
  } catch (err) {
    await params.fs.promises.unlink(tmpPath).catch(() => {});
    throw err;
  }
  return { scanned, rewritten, skipped, aborted: false };
}
