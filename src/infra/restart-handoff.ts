import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

export const GATEWAY_SUPERVISOR_RESTART_HANDOFF_FILENAME =
  "gateway-supervisor-restart-handoff.json";
export const GATEWAY_SUPERVISOR_RESTART_HANDOFF_KIND = "gateway-supervisor-restart-handoff";
const GATEWAY_RESTART_HANDOFF_TTL_MS = 60_000;
const GATEWAY_RESTART_TRACE_HANDOFF_MAX_DURATION_MS = 10 * 60_000;
const GATEWAY_RESTART_HANDOFF_MAX_BYTES = 4096;
const MAX_INTENT_ID_LENGTH = 120;
const MAX_PROCESS_INSTANCE_ID_LENGTH = 120;
const MAX_REASON_LENGTH = 200;

const handoffLog = createSubsystemLogger("restart-handoff");

export type GatewayRestartHandoffRestartKind = "full-process" | "update-process";
export type GatewayRestartHandoffSource =
  | "config-write"
  | "gateway-update"
  | "operator-restart"
  | "plugin-change"
  | "signal"
  | "unknown";
export type GatewayRestartHandoffSupervisorMode = "launchd" | "systemd" | "schtasks" | "external";

export type GatewayRestartHandoff = {
  kind: typeof GATEWAY_SUPERVISOR_RESTART_HANDOFF_KIND;
  version: 1;
  intentId: string;
  pid: number;
  processInstanceId?: string;
  createdAt: number;
  expiresAt: number;
  reason?: string;
  source: GatewayRestartHandoffSource;
  restartKind: GatewayRestartHandoffRestartKind;
  supervisorMode: GatewayRestartHandoffSupervisorMode;
  restartTrace?: {
    startedAt: number;
    lastAt: number;
  };
};

function formatShortDuration(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  if (clamped < 1000) {
    return `${clamped}ms`;
  }
  const seconds = Math.floor(clamped / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

function formatDiagnosticValue(value: string): string {
  let normalized = "";
  let previousWasSpace = true;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || /\s/u.test(char)) {
      if (!previousWasSpace) {
        normalized += " ";
        previousWasSpace = true;
      }
      continue;
    }
    normalized += char;
    previousWasSpace = false;
  }
  return normalized.trimEnd();
}

export function formatGatewayRestartHandoffDiagnostic(
  handoff: GatewayRestartHandoff,
  now = Date.now(),
): string {
  const reason = handoff.reason ? formatDiagnosticValue(handoff.reason) : undefined;
  const detail = [
    `${handoff.restartKind} via ${handoff.supervisorMode}`,
    `source=${handoff.source}`,
    reason ? `reason=${reason}` : undefined,
    `pid=${handoff.pid}`,
    `age=${formatShortDuration(now - handoff.createdAt)}`,
    `expiresIn=${formatShortDuration(handoff.expiresAt - now)}`,
  ].filter((value): value is string => Boolean(value));
  return `Recent restart handoff: ${detail.join("; ")}`;
}

function resolveGatewayRestartHandoffPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), GATEWAY_SUPERVISOR_RESTART_HANDOFF_FILENAME);
}

function unlinkRegularFileSync(filePath: string): boolean {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.nlink > 1) {
      return false;
    }
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function clearGatewayRestartHandoffSync(env: NodeJS.ProcessEnv = process.env): void {
  unlinkRegularFileSync(resolveGatewayRestartHandoffPath(env));
}

function normalizePid(pid: number | undefined): number | null {
  return typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}

function normalizeText(value: unknown, maxLength: number): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : undefined;
}

function normalizeCreatedAt(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : Date.now();
}

function normalizeTtlMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return GATEWAY_RESTART_HANDOFF_TTL_MS;
  }
  return Math.min(Math.floor(value), GATEWAY_RESTART_HANDOFF_TTL_MS);
}

function normalizeRestartTraceHandoff(
  value: unknown,
): GatewayRestartHandoff["restartTrace"] | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as { startedAt?: unknown; lastAt?: unknown };
  if (
    typeof record.startedAt !== "number" ||
    !Number.isFinite(record.startedAt) ||
    typeof record.lastAt !== "number" ||
    !Number.isFinite(record.lastAt)
  ) {
    return undefined;
  }
  const startedAt = Math.floor(record.startedAt);
  const lastAt = Math.floor(record.lastAt);
  if (
    startedAt <= 0 ||
    lastAt < startedAt ||
    lastAt - startedAt > GATEWAY_RESTART_TRACE_HANDOFF_MAX_DURATION_MS
  ) {
    return undefined;
  }
  return { startedAt, lastAt };
}

function isRestartKind(value: unknown): value is GatewayRestartHandoffRestartKind {
  return value === "full-process" || value === "update-process";
}

function isSource(value: unknown): value is GatewayRestartHandoffSource {
  return (
    value === "config-write" ||
    value === "gateway-update" ||
    value === "operator-restart" ||
    value === "plugin-change" ||
    value === "signal" ||
    value === "unknown"
  );
}

function isSupervisorMode(value: unknown): value is GatewayRestartHandoffSupervisorMode {
  return (
    value === "launchd" ||
    value === "systemd" ||
    value === "schtasks" ||
    value === "external"
  );
}

function normalizeSource(
  source: GatewayRestartHandoffSource | undefined,
  reason: string | undefined,
): GatewayRestartHandoffSource {
  if (source) {
    return source;
  }
  if (!reason) {
    return "unknown";
  }
  const normalizedReason = reason.toLowerCase();
  if (normalizedReason.includes("plugin") || normalizedReason.includes("extension")) {
    return "plugin-change";
  }
  if (normalizedReason.includes("config")) {
    return "config-write";
  }
  if (normalizedReason.includes("update")) {
    return "gateway-update";
  }
  if (normalizedReason.includes("operator") || normalizedReason.includes("manual")) {
    return "operator-restart";
  }
  if (normalizedReason.includes("sigusr1") || normalizedReason.includes("signal")) {
    return "signal";
  }
  return "unknown";
}

function parseGatewayRestartHandoff(raw: string): GatewayRestartHandoff | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (
    record.kind !== GATEWAY_SUPERVISOR_RESTART_HANDOFF_KIND ||
    record.version !== 1 ||
    typeof record.intentId !== "string" ||
    !record.intentId.trim() ||
    record.intentId.length > MAX_INTENT_ID_LENGTH ||
    typeof record.pid !== "number" ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0 ||
    typeof record.createdAt !== "number" ||
    !Number.isFinite(record.createdAt) ||
    typeof record.expiresAt !== "number" ||
    !Number.isFinite(record.expiresAt) ||
    record.expiresAt < record.createdAt ||
    record.expiresAt - record.createdAt > GATEWAY_RESTART_HANDOFF_TTL_MS ||
    !isSource(record.source) ||
    !isRestartKind(record.restartKind) ||
    !isSupervisorMode(record.supervisorMode)
  ) {
    return null;
  }

  if (record.reason !== undefined && typeof record.reason !== "string") {
    return null;
  }
  if (record.processInstanceId !== undefined && typeof record.processInstanceId !== "string") {
    return null;
  }

  const reason = normalizeText(record.reason, MAX_REASON_LENGTH);
  const processInstanceId = normalizeText(
    record.processInstanceId,
    MAX_PROCESS_INSTANCE_ID_LENGTH,
  );
  const restartTrace = normalizeRestartTraceHandoff(record.restartTrace);

  return {
    kind: GATEWAY_SUPERVISOR_RESTART_HANDOFF_KIND,
    version: 1,
    intentId: normalizeText(record.intentId, MAX_INTENT_ID_LENGTH)!,
    pid: record.pid,
    ...(processInstanceId ? { processInstanceId } : {}),
    createdAt: Math.floor(record.createdAt),
    expiresAt: Math.floor(record.expiresAt),
    ...(reason ? { reason } : {}),
    source: record.source,
    restartKind: record.restartKind,
    supervisorMode: record.supervisorMode,
    ...(restartTrace ? { restartTrace } : {}),
  };
}

function readGatewayRestartHandoffRawSync(env: NodeJS.ProcessEnv): string | null {
  const handoffPath = resolveGatewayRestartHandoffPath(env);
  try {
    const stat = fs.lstatSync(handoffPath);
    if (!stat.isFile() || stat.nlink > 1 || stat.size > GATEWAY_RESTART_HANDOFF_MAX_BYTES) {
      return null;
    }
    return fs.readFileSync(handoffPath, "utf8");
  } catch {
    return null;
  }
}

export function writeGatewayRestartHandoffSync(opts: {
  env?: NodeJS.ProcessEnv;
  pid?: number;
  processInstanceId?: string;
  reason?: string;
  source?: GatewayRestartHandoffSource;
  restartKind: GatewayRestartHandoffRestartKind;
  supervisorMode?: GatewayRestartHandoffSupervisorMode | null;
  restartTrace?: GatewayRestartHandoff["restartTrace"];
  ttlMs?: number;
  createdAt?: number;
}): GatewayRestartHandoff | null {
  const pid = normalizePid(opts.pid ?? process.pid);
  if (pid === null || !isRestartKind(opts.restartKind)) {
    return null;
  }
  if (opts.source !== undefined && !isSource(opts.source)) {
    return null;
  }
  const supervisorMode = opts.supervisorMode ?? "external";
  if (!isSupervisorMode(supervisorMode)) {
    return null;
  }

  const env = opts.env ?? process.env;
  const createdAt = normalizeCreatedAt(opts.createdAt);
  const ttlMs = normalizeTtlMs(opts.ttlMs);
  const reason = normalizeText(opts.reason, MAX_REASON_LENGTH);
  const processInstanceId = normalizeText(opts.processInstanceId, MAX_PROCESS_INSTANCE_ID_LENGTH);
  const restartTrace = normalizeRestartTraceHandoff(opts.restartTrace);
  const payload: GatewayRestartHandoff = {
    kind: GATEWAY_SUPERVISOR_RESTART_HANDOFF_KIND,
    version: 1,
    intentId: randomUUID(),
    pid,
    ...(processInstanceId ? { processInstanceId } : {}),
    createdAt,
    expiresAt: createdAt + ttlMs,
    ...(reason ? { reason } : {}),
    source: normalizeSource(opts.source, reason),
    restartKind: opts.restartKind,
    supervisorMode,
    ...(restartTrace ? { restartTrace } : {}),
  };

  let tmpPath: string | undefined;
  try {
    const handoffPath = resolveGatewayRestartHandoffPath(env);
    fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
    tmpPath = path.join(
      path.dirname(handoffPath),
      `.${path.basename(handoffPath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
    );
    let fd: number | undefined;
    try {
      fd = fs.openSync(tmpPath, "wx", 0o600);
      fs.writeFileSync(fd, `${JSON.stringify(payload)}\n`, "utf8");
    } finally {
      if (fd !== undefined) {
        fs.closeSync(fd);
      }
    }
    fs.renameSync(tmpPath, handoffPath);
    return payload;
  } catch (err) {
    if (tmpPath) {
      unlinkRegularFileSync(tmpPath);
    }
    handoffLog.warn(`failed to write gateway restart handoff: ${String(err)}`);
    return null;
  }
}

export function readGatewayRestartHandoffSync(
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): GatewayRestartHandoff | null {
  const raw = readGatewayRestartHandoffRawSync(env);
  if (!raw) {
    return null;
  }
  const payload = parseGatewayRestartHandoff(raw);
  if (!payload || now < payload.createdAt || now > payload.expiresAt) {
    return null;
  }
  return payload;
}

export function consumeGatewayRestartHandoffForExitedProcessSync(opts: {
  env?: NodeJS.ProcessEnv;
  exitedPid?: number;
  processInstanceId?: string;
  now?: number;
}): GatewayRestartHandoff | null {
  const env = opts.env ?? process.env;
  const handoffPath = resolveGatewayRestartHandoffPath(env);
  let raw: string | null = null;
  try {
    const stat = fs.lstatSync(handoffPath);
    if (!stat.isFile() || stat.nlink > 1 || stat.size > GATEWAY_RESTART_HANDOFF_MAX_BYTES) {
      return null;
    }
    raw = fs.readFileSync(handoffPath, "utf8");
  } catch {
    return null;
  } finally {
    clearGatewayRestartHandoffSync(env);
  }

  const payload = raw ? parseGatewayRestartHandoff(raw) : null;
  const exitedPid = normalizePid(opts.exitedPid);
  if (!payload || exitedPid === null || payload.pid !== exitedPid) {
    return null;
  }

  const expectedProcessInstanceId = normalizeText(
    opts.processInstanceId,
    MAX_PROCESS_INSTANCE_ID_LENGTH,
  );
  if (expectedProcessInstanceId && payload.processInstanceId !== expectedProcessInstanceId) {
    return null;
  }

  const now = opts.now ?? Date.now();
  if (now < payload.createdAt || now > payload.expiresAt) {
    return null;
  }
  return payload;
}
