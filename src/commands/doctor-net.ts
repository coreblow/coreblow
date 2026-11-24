/**
 * CoreBlow — Doctor Network & Gateway Latency Probe
 *
 * Probes the local CoreBlow Gateway health endpoint and measures real RTT
 * (min / median / p95 / max ms) along with reachability diagnostics.
 *
 * Self-contained module: zero cross-repo dependencies.
 */

import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";

export interface DoctorNetOptions {
  url?: string;
  samples?: number;
  json?: boolean;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface DoctorNetSample {
  index: number;
  rttMs: number;
  status: number;
  ok: boolean;
}

export interface DoctorNetLatencyStats {
  min: number;
  median: number;
  p95: number;
  max: number;
  mean: number;
}

export interface DoctorNetResult {
  targetUrl: string;
  reachable: boolean;
  totalSamples: number;
  successfulSamples: number;
  failedSamples: number;
  statusCode?: number;
  rttMs: DoctorNetLatencyStats | null;
  samples: DoctorNetSample[];
  error?: string;
}

export const DEFAULT_DOCTOR_NET_URL = "http://127.0.0.1:18789/health";
export const DEFAULT_DOCTOR_NET_SAMPLES = 5;
export const DEFAULT_DOCTOR_NET_TIMEOUT_MS = 5000;

export function calculateLatencyStats(latencies: number[]): DoctorNetLatencyStats | null {
  if (latencies.length === 0) return null;
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = Number((sum / sorted.length).toFixed(2));

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));

  // Nearest rank percentile index for p95
  const p95Idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const p95 = sorted[p95Idx];

  return {
    min: Number(min.toFixed(2)),
    median: Number(median.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    max: Number(max.toFixed(2)),
    mean,
  };
}

export async function probeGatewayLatency(options: DoctorNetOptions = {}): Promise<DoctorNetResult> {
  const targetUrl = options.url?.trim() || process.env.COREBLOW_GATEWAY_URL || DEFAULT_DOCTOR_NET_URL;
  const totalSamples = Math.max(1, options.samples ?? DEFAULT_DOCTOR_NET_SAMPLES);
  const timeoutMs = options.timeoutMs ?? DEFAULT_DOCTOR_NET_TIMEOUT_MS;
  const fetchImpl = options.fetchFn ?? globalThis.fetch;

  const samples: DoctorNetSample[] = [];
  const successfulLatencies: number[] = [];
  let lastError: string | undefined;
  let lastStatusCode: number | undefined;

  for (let i = 0; i < totalSamples; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();

    try {
      const response = await fetchImpl(targetUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "CoreBlow-Doctor-Net/2.1.2",
        },
      });
      const durationMs = Number((performance.now() - start).toFixed(2));
      clearTimeout(timer);

      lastStatusCode = response.status;
      samples.push({
        index: i + 1,
        rttMs: durationMs,
        status: response.status,
        ok: response.ok,
      });

      if (response.ok) {
        successfulLatencies.push(durationMs);
      } else {
        lastError = `HTTP ${response.status} ${response.statusText || ""}`.trim();
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      const durationMs = Number((performance.now() - start).toFixed(2));
      const message = err instanceof Error ? err.message : String(err);
      lastError = message;
      samples.push({
        index: i + 1,
        rttMs: durationMs,
        status: 0,
        ok: false,
      });
    }
  }

  const reachable = successfulLatencies.length > 0;
  const rttMs = calculateLatencyStats(successfulLatencies);

  return {
    targetUrl,
    reachable,
    totalSamples,
    successfulSamples: successfulLatencies.length,
    failedSamples: totalSamples - successfulLatencies.length,
    statusCode: lastStatusCode,
    rttMs,
    samples,
    error: reachable ? undefined : lastError,
  };
}

export function formatDoctorNetOutput(result: DoctorNetResult): string {
  const lines: string[] = [];
  lines.push("CoreBlow Gateway Latency & Health Probe");
  lines.push("──────────────────────────────────────────");
  lines.push(`Target:     ${result.targetUrl}`);
  lines.push(
    `Status:     ${result.reachable ? `OK (HTTP ${result.statusCode ?? 200})` : `UNREACHABLE (${result.error ?? "connection refused"})`}`
  );
  lines.push(`Samples:    ${result.successfulSamples}/${result.totalSamples} successful`);

  if (result.rttMs) {
    lines.push("");
    lines.push("Round-Trip Time (RTT):");
    lines.push(`  Min:      ${result.rttMs.min.toFixed(2)} ms`);
    lines.push(`  Median:   ${result.rttMs.median.toFixed(2)} ms`);
    lines.push(`  p95:      ${result.rttMs.p95.toFixed(2)} ms`);
    lines.push(`  Max:      ${result.rttMs.max.toFixed(2)} ms`);
    lines.push(`  Mean:     ${result.rttMs.mean.toFixed(2)} ms`);
  }

  if (!result.reachable) {
    lines.push("");
    lines.push("Diagnostics & Hints:");
    lines.push(`  • Gateway is unreachable at ${result.targetUrl}.`);
    lines.push("  • Is the CoreBlow Gateway service running?");
    lines.push("  • To start the local gateway: coreblow gateway");
  }

  return lines.join("\n");
}

export async function runDoctorNetProbe(
  runtime: RuntimeEnv = defaultRuntime,
  options: DoctorNetOptions = {}
): Promise<DoctorNetResult> {
  const result = await probeGatewayLatency(options);

  if (options.json) {
    runtime.log(JSON.stringify(result, null, 2));
  } else {
    runtime.log(formatDoctorNetOutput(result));
  }

  return result;
}
