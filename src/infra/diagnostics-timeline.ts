import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import type { CoreBlowConfig } from "../config/config.js";
import { isDiagnosticFlagEnabled } from "./diagnostic-flags.js";
import { isTruthyEnvValue } from "./env.js";

const COREBLOW_DIAGNOSTICS_TIMELINE_SCHEMA_VERSION = "coreblow.diagnostics.v1";

type DiagnosticsTimelineAttributes = Record<string, string | number | boolean | null>;

type DiagnosticsTimelineEvent = {
  type: "span.start" | "span.end" | "span.error" | "mark";
  name: string;
  phase?: string;
  spanId?: string;
  parentSpanId?: string;
  durationMs?: number;
  attributes?: DiagnosticsTimelineAttributes;
  errorName?: string;
  errorMessage?: string;
};

type DiagnosticsTimelineOptions = {
  config?: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
};

type DiagnosticsTimelineSpanOptions = DiagnosticsTimelineOptions & {
  phase?: string;
  parentSpanId?: string;
  attributes?: DiagnosticsTimelineAttributes;
};

export type ActiveDiagnosticsTimelineSpan = {
  name: string;
  phase?: string;
  spanId: string;
  parentSpanId?: string;
  attributes?: DiagnosticsTimelineAttributes;
};

const activeDiagnosticsTimelineSpan = new AsyncLocalStorage<ActiveDiagnosticsTimelineSpan>();
const createdTimelineDirs = new Set<string>();

export function isDiagnosticsTimelineEnabled(options: DiagnosticsTimelineOptions = {}): boolean {
  const env = options.env ?? process.env;
  return (
    (isDiagnosticFlagEnabled("timeline", options.config, env) ||
      isDiagnosticFlagEnabled("diagnostics.timeline", options.config, env) ||
      isTruthyEnvValue(env.COREBLOW_DIAGNOSTICS)) &&
    typeof env.COREBLOW_DIAGNOSTICS_TIMELINE_PATH === "string" &&
    env.COREBLOW_DIAGNOSTICS_TIMELINE_PATH.trim().length > 0
  );
}

function normalizeNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value * 1000) / 1000)
    : undefined;
}

function normalizeAttributes(
  attributes: DiagnosticsTimelineAttributes | undefined,
): DiagnosticsTimelineAttributes | undefined {
  if (!attributes) {
    return undefined;
  }
  const normalized: DiagnosticsTimelineAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === "number") {
      if (Number.isFinite(value)) {
        normalized[key] = normalizeNumber(value) ?? 0;
      }
    } else if (typeof value === "string" || typeof value === "boolean" || value === null) {
      normalized[key] = value;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function emitDiagnosticsTimelineEvent(
  event: DiagnosticsTimelineEvent,
  options: DiagnosticsTimelineOptions = {},
): void {
  const env = options.env ?? process.env;
  if (!isDiagnosticsTimelineEnabled({ config: options.config, env })) {
    return;
  }
  const filePath = env.COREBLOW_DIAGNOSTICS_TIMELINE_PATH?.trim();
  if (!filePath) {
    return;
  }
  const dir = dirname(filePath);
  if (!createdTimelineDirs.has(dir)) {
    mkdirSync(dir, { recursive: true });
    createdTimelineDirs.add(dir);
  }
  appendFileSync(
    filePath,
    `${JSON.stringify({
      schemaVersion: COREBLOW_DIAGNOSTICS_TIMELINE_SCHEMA_VERSION,
      type: event.type,
      timestamp: new Date().toISOString(),
      name: event.name,
      ...(env.COREBLOW_DIAGNOSTICS_RUN_ID ? { runId: env.COREBLOW_DIAGNOSTICS_RUN_ID } : {}),
      pid: process.pid,
      ...(event.phase ? { phase: event.phase } : {}),
      ...(event.spanId ? { spanId: event.spanId } : {}),
      ...(event.parentSpanId ? { parentSpanId: event.parentSpanId } : {}),
      ...(typeof event.durationMs === "number" ? { durationMs: normalizeNumber(event.durationMs) } : {}),
      ...(event.errorName ? { errorName: event.errorName } : {}),
      ...(event.errorMessage ? { errorMessage: event.errorMessage } : {}),
      ...(normalizeAttributes(event.attributes) ? { attributes: normalizeAttributes(event.attributes) } : {}),
    })}\n`,
  );
}

export function getActiveDiagnosticsTimelineSpan(): ActiveDiagnosticsTimelineSpan | undefined {
  return activeDiagnosticsTimelineSpan.getStore();
}

export async function measureDiagnosticsTimelineSpan<T>(
  name: string,
  run: () => Promise<T> | T,
  options: DiagnosticsTimelineSpanOptions = {},
): Promise<T> {
  return measureDiagnosticsTimelineSpanInternal(name, run, options);
}

export function measureDiagnosticsTimelineSpanSync<T>(
  name: string,
  run: () => T,
  options: DiagnosticsTimelineSpanOptions = {},
): T {
  return measureDiagnosticsTimelineSpanInternal(name, run, options) as T;
}

function measureDiagnosticsTimelineSpanInternal<T>(
  name: string,
  run: () => Promise<T> | T,
  options: DiagnosticsTimelineSpanOptions,
): Promise<T> | T {
  const env = options.env ?? process.env;
  if (!isDiagnosticsTimelineEnabled({ config: options.config, env })) {
    return run();
  }
  const activeSpan = getActiveDiagnosticsTimelineSpan();
  const spanId = randomUUID();
  const phase = options.phase ?? activeSpan?.phase;
  const parentSpanId = options.parentSpanId ?? activeSpan?.spanId;
  const startedAt = performance.now();
  emitDiagnosticsTimelineEvent({ type: "span.start", name, phase, spanId, parentSpanId, attributes: options.attributes }, { config: options.config, env });
  const finish = (type: "span.end" | "span.error", error?: unknown) => {
    emitDiagnosticsTimelineEvent(
      {
        type,
        name,
        phase,
        spanId,
        parentSpanId,
        durationMs: performance.now() - startedAt,
        attributes: options.attributes,
        ...(error ? { errorName: error instanceof Error ? error.name : typeof error, errorMessage: error instanceof Error ? error.message : String(error) } : {}),
      },
      { config: options.config, env },
    );
  };
  return activeDiagnosticsTimelineSpan.run({ name, ...(phase ? { phase } : {}), spanId, ...(parentSpanId ? { parentSpanId } : {}) }, () => {
    try {
      const result = run();
      if (result && typeof (result as Promise<T>).then === "function") {
        return (result as Promise<T>).then(
          (value) => {
            finish("span.end");
            return value;
          },
          (error) => {
            finish("span.error", error);
            throw error;
          },
        );
      }
      finish("span.end");
      return result;
    } catch (error) {
      finish("span.error", error);
      throw error;
    }
  });
}

export async function flushDiagnosticsTimelineForTest(): Promise<void> {
  await Promise.resolve();
}
